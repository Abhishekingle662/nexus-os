from pathlib import Path
import os
import sys
import asyncio
import json
from dotenv import load_dotenv

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn

APP_DIR = Path(__file__).resolve().parent
BACKEND_ROOT = APP_DIR.parent
REPO_ROOT = BACKEND_ROOT.parent

# Load env vars before importing agent modules so API clients can read keys.
# `override=True` prevents stale shell-level keys from masking updated .env values.
load_dotenv(REPO_ROOT / ".env", override=True)
load_dotenv(BACKEND_ROOT / ".env", override=True)

if __package__ in (None, ""):
    if str(BACKEND_ROOT) not in sys.path:
        sys.path.insert(0, str(BACKEND_ROOT))

    from app.agents.coder import coder_node
    from app.agents.planner import planner_node
    from app.agents.researcher import researcher_node
    from app.agents.supervisor import supervisor_node
    from app.agents.tester import tester_node
    from app.core.swarm_graph import create_parallel_swarm
    from app.core.trace_queue import live_events
else:
    from .agents.coder import coder_node
    from .agents.planner import planner_node
    from .agents.researcher import researcher_node
    from .agents.supervisor import supervisor_node
    from .agents.tester import tester_node
    from .core.swarm_graph import create_parallel_swarm
    from .core.trace_queue import live_events

app = FastAPI(title="NexusOS MVP")

GENERATED_DIR = APP_DIR.parent / "generated"
GENERATED_DIR.mkdir(exist_ok=True)

def auto_save_code(code: str, filename: str = "streaming_example.py"):
    try:
        GENERATED_DIR.mkdir(exist_ok=True)
        filepath = GENERATED_DIR / filename
        filepath.write_text(code, encoding="utf-8")
        print(f"Auto-saved: {filepath}")
        return filepath
    except Exception as e:
        print(f"Auto-save failed: {e}")
        return None

class MissionRequest(BaseModel):
    task: str

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

graph = create_parallel_swarm(
    supervisor_node=supervisor_node,
    planner_node=planner_node,
    researcher_node=researcher_node,
    coder_node=coder_node,
    tester_node=tester_node,
)

active_connections: list[WebSocket] = []


async def broadcast(message: dict):
    """Send a message to all connected websocket clients."""
    dead_connections: list[WebSocket] = []

    for connection in active_connections:
        try:
            await connection.send_text(json.dumps(message))
        except Exception:
            dead_connections.append(connection)

    for dead in dead_connections:
        if dead in active_connections:
            active_connections.remove(dead)

@app.post("/start-mission")
async def start_mission(request: MissionRequest):
    task = request.task.strip()
    if not task:
        raise HTTPException(status_code=400, detail="Task is required.")

    import uuid, threading
    thread_id = str(uuid.uuid4())
    config = {"configurable": {"thread_id": thread_id}, "recursion_limit": 10}
    initial_state = {
        "task": task,
        "messages": [],
        "next": "supervisor",
        "status": "starting",
        "code": None,
    }

    # Flush any stale events from a previous mission
    while not live_events.empty():
        try:
            live_events.get_nowait()
        except Exception:
            break

    await broadcast({
        "type": "mission_start",
        "task": task,
        "content": f"Mission started: {task}",
    })

    loop: asyncio.AbstractEventLoop = asyncio.get_event_loop()
    queue: asyncio.Queue = asyncio.Queue()
    graph_done = threading.Event()

    def run_graph():
        try:
            for output in graph.stream(initial_state, config, stream_mode="values"):
                loop.call_soon_threadsafe(queue.put_nowait, ("output", output))
            loop.call_soon_threadsafe(queue.put_nowait, ("done", None))
        except Exception as exc:
            loop.call_soon_threadsafe(queue.put_nowait, ("error", exc))
        finally:
            graph_done.set()

    def drain_live_events():
        """Forward live trace events to the asyncio queue in real time."""
        while not graph_done.is_set():
            try:
                event = live_events.get(timeout=0.05)
                loop.call_soon_threadsafe(queue.put_nowait, ("trace", event))
            except Exception:
                pass
        # Drain any remaining events after the graph finishes
        while not live_events.empty():
            try:
                event = live_events.get_nowait()
                loop.call_soon_threadsafe(queue.put_nowait, ("trace", event))
            except Exception:
                break

    threading.Thread(target=run_graph, daemon=True).start()
    threading.Thread(target=drain_live_events, daemon=True).start()

    final_code = None

    try:
        while True:
            kind, payload = await queue.get()
            if kind == "done":
                break
            if kind == "error":
                raise payload
            if kind == "trace":
                await broadcast({"type": "trace_event", "event": payload})
                continue

            output = payload
            messages = output.get("messages", [])
            if messages:
                last_msg = messages[-1]
                content = getattr(last_msg, "content", str(last_msg))
                status = output.get("status", "unknown")
                agent = status.split("_")[0] if status != "unknown" else "unknown"

                await broadcast({
                    "type": "agent_message",
                    "agent": agent,
                    "content": content,
                    "next": output.get("next", "unknown"),
                })

                if "coder" in status.lower() and ("```python" in content or "import " in content):
                    final_code = content

        if final_code:
            filepath = auto_save_code(final_code)
            if filepath:
                await broadcast({
                    "type": "agent_message",
                    "agent": "system",
                    "content": f"File saved: {filepath}",
                    "next": "END",
                })

        await broadcast({
            "type": "mission_complete",
            "status": "done",
            "content": "Mission complete.",
        })
        return {"status": "completed", "thread_id": thread_id}

    except Exception as exc:
        import traceback
        traceback.print_exc()          # full traceback in uvicorn terminal
        message = f"Mission execution failed: {exc}"
        await broadcast({"type": "error", "message": message, "content": message})
        raise HTTPException(status_code=500, detail=message)

@app.get("/files")
async def list_files():
    files = [f.name for f in GENERATED_DIR.iterdir() if f.is_file()]
    return {"files": sorted(files)}

@app.get("/files/{filename}")
async def get_file(filename: str):
    path = GENERATED_DIR / filename
    if not path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    return {"filename": filename, "content": path.read_text(encoding="utf-8")}

# WebSocket for real-time dashboard
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    active_connections.append(websocket)
    print(f"[WS] Client connected. Total: {len(active_connections)}")
    while True:
        try:
            await websocket.receive_text()
        except WebSocketDisconnect:
            if websocket in active_connections:
                active_connections.remove(websocket)
            print(f"[WS] Client disconnected. Total: {len(active_connections)}")
            break


if __name__ == "__main__":
    # Supports: `python .\\main.py` from backend/app
    uvicorn.run(app, host="0.0.0.0", port=8000)
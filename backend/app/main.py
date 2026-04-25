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
    from app.core.graph import create_nexus_graph
    from app.tools import available_tools
else:
    from .agents.coder import coder_node
    from .agents.planner import planner_node
    from .agents.researcher import researcher_node
    from .agents.supervisor import supervisor_node
    from .agents.tester import tester_node
    from .core.graph import create_nexus_graph
    from .tools import available_tools

app = FastAPI(title="NexusOS MVP")


class MissionRequest(BaseModel):
    task: str

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

graph = create_nexus_graph(
    supervisor_node=supervisor_node,
    planner_node=planner_node,
    researcher_node=researcher_node,
    coder_node=coder_node,
    tester_node=tester_node,
    available_tools=available_tools,
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

    thread_id = "demo-1"
    config = {"configurable": {"thread_id": thread_id}, "recursion_limit": 10}
    initial_state = {
        "task": task,
        "messages": [],
        "next": "supervisor",
        "status": "starting",
        "code": None,
    }

    await broadcast({
        "type": "mission_start",
        "task": task,
        "content": f"Mission started: {task}",
    })

    loop = asyncio.get_event_loop()
    queue: asyncio.Queue = asyncio.Queue()

    def run_graph():
        try:
            for output in graph.stream(initial_state, config, stream_mode="values"):
                loop.call_soon_threadsafe(queue.put_nowait, ("output", output))
            loop.call_soon_threadsafe(queue.put_nowait, ("done", None))
        except Exception as exc:
            loop.call_soon_threadsafe(queue.put_nowait, ("error", exc))

    try:
        import threading
        threading.Thread(target=run_graph, daemon=True).start()

        while True:
            kind, payload = await queue.get()

            if kind == "done":
                break
            if kind == "error":
                raise payload

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

        await broadcast({
            "type": "mission_complete",
            "status": "done",
            "content": "Mission complete.",
        })
        return {"status": "completed", "thread_id": thread_id}
    except Exception as exc:
        message = f"Mission execution failed: {exc}"
        await broadcast({"type": "error", "message": message, "content": message})
        raise HTTPException(status_code=500, detail=message)

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
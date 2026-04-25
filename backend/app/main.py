from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from langgraph.graph import StateGraph
import uvicorn
from .core.graph import create_nexus_graph

app = FastAPI(title="NexusOS MVP")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

graph = create_nexus_graph()

@app.post("/start-mission")
async def start_mission(task: str):
    config = {"configurable": {"thread_id": "1"}}
    inputs = {"task": task, "messages": [], "next": "supervisor"}
    result = graph.invoke(inputs, config)
    return {"status": "running", "result": result}

# WebSocket for real-time dashboard
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    # Stream agent steps here (implement later)
    while True:
        data = await websocket.receive_text()
        await websocket.send_text(f"Agent update: {data}")
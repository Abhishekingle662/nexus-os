from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
from .agents.coder import coder_node
from .agents.planner import planner_node
from .agents.researcher import researcher_node
from .agents.supervisor import supervisor_node
from .agents.tester import tester_node
from .core.graph import create_nexus_graph
from .tools import available_tools

app = FastAPI(title="NexusOS MVP")

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
from langgraph.graph import StateGraph, END
from langgraph.checkpoint.memory import MemorySaver
from typing import TypedDict, Annotated
import operator

class AgentState(TypedDict):
    messages: Annotated[list, operator.add]
    next: str
    task: str
    code: str | None
    status: str

# Import your agent nodes here (we'll create them next)
from app.agents.supervisor import supervisor_node
from app.agents.planner import planner_node
from app.agents.researcher import researcher_node
from app.agents.coder import coder_node
from app.agents.tester import tester_node

def create_nexus_graph():
    workflow = StateGraph(AgentState)
    
    workflow.add_node("supervisor", supervisor_node)
    workflow.add_node("planner", planner_node)
    workflow.add_node("researcher", researcher_node)
    workflow.add_node("coder", coder_node)
    workflow.add_node("tester", tester_node)
    
    workflow.set_entry_point("supervisor")
    
    # Routing logic
    workflow.add_conditional_edges(
        "supervisor",
        lambda x: x["next"],
        {
            "planner": "planner",
            "researcher": "researcher",
            "coder": "coder",
            "tester": "tester",
            "END": END
        }
    )
    
    # Simple cycle back to supervisor
    for node in ["planner", "researcher", "coder", "tester"]:
        workflow.add_edge(node, "supervisor")
    
    memory = MemorySaver()
    return workflow.compile(checkpointer=memory)
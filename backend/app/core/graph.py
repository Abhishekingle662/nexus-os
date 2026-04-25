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

def create_nexus_graph(
    supervisor_node,
    planner_node,
    researcher_node,
    coder_node,
    tester_node,
    available_tools=None,
):
    workflow = StateGraph(AgentState)

    # Keep tool injection available for future tool-aware routing/validation.
    _ = available_tools
    
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
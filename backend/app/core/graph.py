# backend/app/core/graph.py
from typing import TypedDict, Annotated, Dict
import operator
from langgraph.graph import StateGraph, END
from langgraph.checkpoint.memory import MemorySaver

class AgentState(TypedDict):
    task: str
    messages: Annotated[list, operator.add]
    next: str
    status: str
    code: str | None

def create_nexus_graph(
    supervisor_node,
    planner_node,
    researcher_node,
    coder_node,
    tester_node,
    available_tools,   # not used directly here but kept for your signature
):
    workflow = StateGraph(AgentState)

    # Add all nodes
    workflow.add_node("supervisor", supervisor_node)
    workflow.add_node("planner", planner_node)
    workflow.add_node("researcher", researcher_node)
    workflow.add_node("coder", coder_node)
    workflow.add_node("tester", tester_node)

    # Entry point
    workflow.set_entry_point("supervisor")

    # Supervisor decides where to go next
    workflow.add_conditional_edges(
        "supervisor",
        lambda state: state["next"],
        {
            "planner": "planner",
            "researcher": "researcher",
            "coder": "coder",
            "tester": "tester",
            "END": END,
        },
    )

    # Every other agent routes back to supervisor
    for node in ["planner", "researcher", "coder", "tester"]:
        workflow.add_edge(node, "supervisor")

    memory = MemorySaver()
    return workflow.compile(checkpointer=memory)
# backend/app/core/swarm_graph.py
from typing import TypedDict, Annotated, List
import operator
from langgraph.graph import StateGraph, START, END
from langgraph.checkpoint.memory import MemorySaver
from langgraph.types import Send

class AgentState(TypedDict):
    task: str
    messages: Annotated[list, operator.add]
    next: str | List[str]
    status: str
    code: str | None

def create_parallel_swarm(
    supervisor_node,
    planner_node,
    researcher_node,
    coder_node,
    tester_node,
):
    workflow = StateGraph(AgentState)

    # Add all nodes
    workflow.add_node("supervisor", supervisor_node)
    workflow.add_node("planner", planner_node)
    workflow.add_node("researcher", researcher_node)
    workflow.add_node("coder", coder_node)
    workflow.add_node("tester", tester_node)

    # Entry point is always supervisor
    workflow.set_entry_point("supervisor")

    # Supervisor can send to multiple agents in parallel
    def route_supervisor(state: AgentState):
        next_step = state["next"]
        if isinstance(next_step, list):
            # Parallel execution
            return [Send(agent, state) for agent in next_step]
        elif next_step == "END":
            return END
        else:
            return next_step

    workflow.add_conditional_edges("supervisor", route_supervisor)

    # All agents route back to supervisor after finishing
    for node in ["planner", "researcher", "coder", "tester"]:
        workflow.add_edge(node, "supervisor")

    memory = MemorySaver()
    return workflow.compile(checkpointer=memory)
# backend/app/agents/supervisor.py
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.messages import AIMessage
from pydantic import BaseModel, Field
from typing import Literal, List, Union, Dict
from ..core.trace_queue import live_events

llm = ChatOpenAI(model="o3-mini")

class SupervisorDecision(BaseModel):
    reasoning: str = Field(description="Brief reasoning")
    next: Union[Literal["planner", "researcher", "coder", "tester", "END"], List[str]]

supervisor_prompt = ChatPromptTemplate.from_messages([
    ("system", """You are the NexusOS Supervisor.

You can send ONE agent or MULTIPLE agents in parallel.
Example: ["researcher", "planner"] to run them at the same time.

Current mission: {task}

Decide what to do next."""),
    ("placeholder", "{messages}"),
])

structured_llm = llm.with_structured_output(SupervisorDecision)

def supervisor_node(state: Dict):
    live_events.put({"type": "agent_start", "agent": "supervisor"})

    prompt = supervisor_prompt.invoke({
        "task": state.get("task", ""),
        "messages": state.get("messages", [])
    })
    decision = structured_llm.invoke(prompt)

    live_events.put({"type": "agent_handoff", "agent": "supervisor", "to": decision.next})

    return {
        "messages": state.get("messages", []) + [
            AIMessage(content=f"{decision.reasoning}\n→ Next: {decision.next}")
        ],
        "next": decision.next,
        "status": "supervisor_decision",
    }

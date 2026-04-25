# backend/app/agents/supervisor.py
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.messages import AIMessage
from pydantic import BaseModel, Field
from typing import Literal, Dict

llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)

class SupervisorDecision(BaseModel):
    reasoning: str = Field(description="Brief reasoning for your decision")
    next: Literal["planner", "researcher", "coder", "tester", "END"]

supervisor_prompt = ChatPromptTemplate.from_messages([
    ("system", """You are the NexusOS Supervisor.

Current mission: {task}

ROUTING RULES:
- If the mission asks to "create", "build", "write", "example script", or "code" → always route to researcher first, then to coder.
- Only call END when the coder has saved the actual file using tools and the task is complete.
- Do not end early if code was only described in text."""),
    ("placeholder", "{messages}"),
])

structured_llm = llm.with_structured_output(SupervisorDecision)

def supervisor_node(state: Dict):
    prompt = supervisor_prompt.invoke({
        "task": state.get("task", ""),
        "messages": state.get("messages", [])
    })
    decision = structured_llm.invoke(prompt)
    
    return {
        "messages": state.get("messages", []) + [
            AIMessage(content=f"{decision.reasoning}\n→ Next: {decision.next}")
        ],
        "next": decision.next,
        "status": "supervisor_decision"
    }
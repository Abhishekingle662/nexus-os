# backend/app/agents/supervisor.py
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.messages import AIMessage
from pydantic import BaseModel, Field
from typing import Literal, Dict

llm = ChatOpenAI(model="o3-mini", temperature=1)

class SupervisorDecision(BaseModel):
    reasoning: str = Field(description="Brief reasoning for your decision")
    next: Literal["planner", "researcher", "coder", "tester", "END"]

supervisor_prompt = ChatPromptTemplate.from_messages([
    ("system", """You are the NexusOS Supervisor.

Current mission: {task}

ROUTING RULES:
- Research/info tasks ("news", "latest", "recent", "what is", "summarize", "find", "explain") → researcher. END only after researcher has responded.
- Coding tasks ("create", "build", "write", "script", "code", "implement") → researcher first (for context), then coder. END only after coder has produced code.
- Complex tasks → planner first, then researcher and/or coder as needed.
- NEVER route to END before the relevant agent has done its work.
- Check the message history — if researcher or coder has already responded for this mission, you may END."""),
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
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.messages import AIMessage
from pydantic import BaseModel, Field
from typing import Literal, Dict

llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)

class SupervisorDecision(BaseModel):
    reasoning: str = Field(description="Brief reasoning")
    next: Literal["planner", "researcher", "coder", "tester", "END"]

supervisor_prompt = ChatPromptTemplate.from_messages([
    ("system", """You are the NexusOS Supervisor. Current mission: {task}

Agent roster: planner, researcher, coder, tester.

Rules:
- First call: send to planner.
- After planner: send to coder (skip researcher for simple tasks).
- After coder: send to tester.
- After tester: return END.
- If messages already contain output from planner + coder + tester → END immediately.
- Never visit the same agent twice. When in doubt, END."""),
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
        "messages": state.get("messages", []) + [AIMessage(content=f"{decision.reasoning}\n→ Next: {decision.next}")],
        "next": decision.next,
        "status": "supervisor_decision"
    }
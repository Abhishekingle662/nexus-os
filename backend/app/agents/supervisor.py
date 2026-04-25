# backend/app/agents/supervisor.py
from langchain_core.prompts import ChatPromptTemplate
from langchain_openai import ChatOpenAI
from langchain_core.messages import AIMessage
from pydantic import BaseModel, Field
from typing import Literal, Dict

llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)

class SupervisorDecision(BaseModel):
    reasoning: str = Field(description="Brief reasoning for your decision")
    next: Literal["planner", "researcher", "coder", "tester", "END"] = Field(
        description="Next agent or END when the mission is fully complete"
    )

supervisor_prompt = ChatPromptTemplate.from_messages([
    ("system", """You are the NexusOS Supervisor Agent.

Current mission: {task}

You coordinate planner, researcher, coder, and tester.

RULES FOR ENDING:
- If the coder has already provided a complete, working script for this mission → call END
- If all necessary work is done and you see the final code in the conversation → call END
- Only continue calling agents if something is still missing (plan, research, code, tests)

Be decisive. This is a simple mission — do not loop forever."""),
    ("placeholder", "{messages}"),
])

structured_llm = llm.with_structured_output(SupervisorDecision)

def supervisor_node(state: Dict):
    prompt = supervisor_prompt.invoke({
        "task": state.get("task", ""),
        "messages": state.get("messages", [])
    })
    
    decision: SupervisorDecision = structured_llm.invoke(prompt)
    
    return {
        "messages": state.get("messages", []) + [
            AIMessage(content=f"{decision.reasoning}\n→ Next: {decision.next}")
        ],
        "next": decision.next,
        "status": "supervisor_decision"
    }
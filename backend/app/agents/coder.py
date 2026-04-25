# backend/app/agents/coder.py
from langchain_core.prompts import ChatPromptTemplate
from langchain_openai import ChatOpenAI
from langchain_core.messages import AIMessage
from typing import Dict

llm = ChatOpenAI(model="gpt-4o-mini", temperature=0.2)

coder_prompt = ChatPromptTemplate.from_messages([
    ("system", """You are the Coder Agent for NexusOS.
Write clean, complete, production-ready code for the current mission.
If you need to save files, just describe it clearly in your response for now.
Do NOT call tools in this version."""),
    ("placeholder", "{messages}"),
    ("user", "Mission: {task}")
])

def coder_node(state: Dict):
    prompt = coder_prompt.invoke({
        "task": state.get("task", ""),
        "messages": state.get("messages", [])
    })
    
    response = llm.invoke(prompt)
    
    return {
        "messages": state.get("messages", []) + [AIMessage(content=response.content)],
        "next": "supervisor",
        "status": "coder_decision",
        "code": response.content
    }
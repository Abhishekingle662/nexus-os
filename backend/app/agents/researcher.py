# backend/app/agents/researcher.py
from langchain_core.prompts import ChatPromptTemplate
from langchain_openai import ChatOpenAI
from langchain_core.messages import AIMessage
from typing import Dict

llm = ChatOpenAI(model="gpt-4o-mini", temperature=0.2)

researcher_prompt = ChatPromptTemplate.from_messages([
    ("system", """You are the Researcher Agent for NexusOS.
Research best practices, libraries, and architecture for the mission.
Summarize your findings clearly. Do NOT call tools in this version."""),
    ("placeholder", "{messages}"),
    ("user", "Mission: {task}")
])

def researcher_node(state: Dict):
    prompt = researcher_prompt.invoke({
        "task": state.get("task", ""),
        "messages": state.get("messages", [])
    })
    
    response = llm.invoke(prompt)
    
    return {
        "messages": state.get("messages", []) + [AIMessage(content=response.content)],
        "next": "supervisor",
        "status": "researcher_decision"
    }
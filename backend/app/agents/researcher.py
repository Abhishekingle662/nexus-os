# backend/app/agents/researcher.py
from langchain_core.prompts import ChatPromptTemplate
from langchain_openai import ChatOpenAI
from ..tools import available_tools
from typing import Dict

llm = ChatOpenAI(model="gpt-4o-mini", temperature=0.2).bind_tools(available_tools)

researcher_prompt = ChatPromptTemplate.from_messages([
    ("system", """You are the Researcher Agent.
Use tools to gather latest best practices, libraries, and architecture advice.
Summarize findings clearly for the coding team."""),
    ("placeholder", "{messages}"),
    ("user", "Mission: {task}")
])

def researcher_node(state: Dict):
    prompt = researcher_prompt.invoke({
        "task": state.get("task"),
        "messages": state.get("messages", [])
    })
    
    response = llm.invoke(prompt)
    
    return {
        "messages": state.get("messages", []) + [response],
        "next": "supervisor",
        "status": "research_complete"
    }
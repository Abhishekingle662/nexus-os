# backend/app/agents/researcher.py
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.messages import AIMessage
from typing import Dict

llm = ChatOpenAI(model="gpt-4o-mini", temperature=0.3)

researcher_prompt = ChatPromptTemplate.from_messages([
    ("system", """You are the Researcher Agent.
Your job is to gather and summarize up-to-date information.
Never write code yourself — just provide facts, links, and summaries.
Let the Coder create any scripts."""),
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
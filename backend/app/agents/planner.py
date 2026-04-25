# backend/app/agents/planner.py
from langchain_core.prompts import ChatPromptTemplate
from langchain_openai import ChatOpenAI
from typing import Dict

llm = ChatOpenAI(model="gpt-4o-mini", temperature=0.3)

planner_prompt = ChatPromptTemplate.from_messages([
    ("system", """You are the Planner Agent for NexusOS.
Break down the mission into clear, actionable steps.
Consider tech stack, features, and order of implementation.
Return a numbered list of tasks."""),
    ("placeholder", "{messages}"),
    ("user", "Mission: {task}")
])

def planner_node(state: Dict):
    prompt = planner_prompt.invoke({
        "task": state.get("task"),
        "messages": state.get("messages", [])
    })
    
    response = llm.invoke(prompt)
    
    return {
        "messages": state.get("messages", []) + [response],
        "next": "supervisor",
        "status": "planning_complete"
    }
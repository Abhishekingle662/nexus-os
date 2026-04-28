from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.messages import AIMessage
from typing import Dict

llm = ChatOpenAI(model="o3-mini", temperature=1)

prompt = ChatPromptTemplate.from_messages([
    ("system", """You are the Planner Agent.
Break down the mission into clear, actionable steps.
Consider tech stack, features, and order of implementation.
Return a numbered list of tasks."""),
    ("placeholder", "{messages}"),
    ("user", "Mission: {task}")
])

def planner_node(state: Dict):
    p = prompt.invoke({"task": state.get("task", ""), "messages": state.get("messages", [])})
    response = llm.invoke(p)
    return {
        "messages": state.get("messages", []) + [AIMessage(content=response.content)],
        "next": "supervisor",
        "status": "planning_complete"
    }

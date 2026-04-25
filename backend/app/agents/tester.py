# backend/app/agents/tester.py
from langchain_core.prompts import ChatPromptTemplate
from langchain_openai import ChatOpenAI
from ..tools import available_tools, execute_code
from typing import Dict

llm = ChatOpenAI(model="gpt-4o-mini", temperature=0).bind_tools(available_tools)

tester_prompt = ChatPromptTemplate.from_messages([
    ("system", """You are the Tester Agent.
Review the code, suggest tests, run them using tools, and report bugs/fixes."""),
    ("placeholder", "{messages}"),
    ("user", "Mission: {task}")
])

def tester_node(state: Dict):
    prompt = tester_prompt.invoke({
        "task": state.get("task"),
        "messages": state.get("messages", [])
    })
    
    response = llm.invoke(prompt)
    
    return {
        "messages": state.get("messages", []) + [response],
        "next": "supervisor",
        "status": "testing_complete"
    }
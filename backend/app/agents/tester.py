from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.messages import AIMessage
from typing import Dict

llm = ChatOpenAI(model="gpt-4o-mini", temperature=0.3)

prompt = ChatPromptTemplate.from_messages([
    ("system", """You are the Tester Agent.
Review the code, suggest tests, and report bugs and fixes."""),
    ("placeholder", "{messages}"),
    ("user", "Mission: {task}")
])

def tester_node(state: Dict):
    p = prompt.invoke({"task": state.get("task", ""), "messages": state.get("messages", [])})
    response = llm.invoke(p)
    return {
        "messages": state.get("messages", []) + [AIMessage(content=response.content)],
        "next": "supervisor",
        "status": "testing_complete"
    }

# backend/app/agents/coder.py
from langchain_core.prompts import ChatPromptTemplate
from langchain_openai import ChatOpenAI
from ..tools import available_tools, save_code_to_file
from typing import Dict

llm = ChatOpenAI(model="gpt-4o", temperature=0.1).bind_tools(available_tools)

coder_prompt = ChatPromptTemplate.from_messages([
    ("system", """You are the Coder Agent.
Write clean, production-ready full-stack code based on the plan and research.
Use modern best practices. Save files using the save_code_to_file tool."""),
    ("placeholder", "{messages}"),
    ("user", "Mission: {task}")
])

def coder_node(state: Dict):
    prompt = coder_prompt.invoke({
        "task": state.get("task"),
        "messages": state.get("messages", [])
    })
    
    response = llm.invoke(prompt)
    
    # Auto-save if code is in the response (basic)
    if "```" in response.content:
        # Simple extraction - improve later
        pass
    
    return {
        "messages": state.get("messages", []) + [response],
        "next": "supervisor",
        "code": response.content,
        "status": "coding_complete"
    }
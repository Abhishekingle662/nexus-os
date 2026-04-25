# backend/app/agents/supervisor.py
from langchain_core.prompts import ChatPromptTemplate
from langchain_openai import ChatOpenAI
from typing import Dict

llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)

supervisor_prompt = ChatPromptTemplate.from_messages([
    ("system", """You are the NexusOS Supervisor Agent.
You coordinate a team of specialist agents to complete the user's mission.

Available agents:
- planner: Breaks down the task into steps
- researcher: Gathers information and best practices
- coder: Writes the actual code
- tester: Tests and debugs the code

Current mission: {task}

Decide the next agent to call or reply with 'END' when the mission is complete.
Always respond with clear reasoning then the agent name or END."""),
    ("placeholder", "{messages}")
])

def supervisor_node(state: Dict):
    prompt = supervisor_prompt.invoke({
        "task": state.get("task", "No task provided"),
        "messages": state.get("messages", [])
    })
    
    response = llm.invoke(prompt)
    
    content = response.content.lower()
    if any(word in content for word in ["end", "complete", "finished", "done"]):
        next_agent = "END"
    elif "research" in content or "search" in content:
        next_agent = "researcher"
    elif "plan" in content or "step" in content:
        next_agent = "planner"
    elif "test" in content or "debug" in content or "check" in content:
        next_agent = "tester"
    else:
        next_agent = "coder"
    
    return {
        "messages": state.get("messages", []) + [response],
        "next": next_agent,
        "status": "supervisor_decision"
    }
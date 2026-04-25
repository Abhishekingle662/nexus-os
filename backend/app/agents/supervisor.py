from langchain_core.prompts import ChatPromptTemplate
from langchain_openai import ChatOpenAI
from app.agents.tools import available_tools

llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)

supervisor_prompt = ChatPromptTemplate.from_messages([
    ("system", """You are the NexusOS Supervisor.
    Current task: {task}
    
    Available agents: planner, researcher, coder, tester
    Decide who should act next or respond with END when complete."""),
    ("placeholder", "{messages}")
])

def supervisor_node(state: dict):
    prompt = supervisor_prompt.invoke({
        "task": state["task"],
        "messages": state["messages"]
    })
    response = llm.invoke(prompt)
    
    # Simple routing logic (you can make this smarter)
    content = response.content.lower()
    if "end" in content or "done" in content:
        next_agent = "END"
    elif "research" in content:
        next_agent = "researcher"
    elif "code" in content or "write" in content:
        next_agent = "coder"
    elif "test" in content:
        next_agent = "tester"
    else:
        next_agent = "planner"
    
    return {
        "messages": [response],
        "next": next_agent
    }
# backend/app/agents/researcher.py
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.messages import AIMessage, ToolMessage
from .tools import web_search, available_tools
from typing import Dict

llm = ChatOpenAI(model="o3-mini", temperature=1)

# Force the first call to use web_search; follow-ups are auto
llm_forced = llm.bind_tools([web_search], tool_choice="required")
llm_with_tools = llm.bind_tools(available_tools)

researcher_prompt = ChatPromptTemplate.from_messages([
    ("system", """You are the Researcher Agent for NexusOS.
IMPORTANT: You MUST call the web_search tool before answering. Do not answer from memory.
After getting search results, summarize clearly with key takeaways and potential impact."""),
    ("placeholder", "{messages}"),
    ("user", "Mission: {task}")
])

def researcher_node(state: Dict):
    messages = state.get("messages", [])
    task = state.get("task", "")

    prompt_messages = researcher_prompt.invoke({
        "task": task,
        "messages": messages,
    }).messages

    chat_messages = list(prompt_messages)

    # Step 1: force a web_search — model cannot skip this
    response = llm_forced.invoke(chat_messages)
    chat_messages.append(response)
    for tc in response.tool_calls:
        tool = next((t for t in available_tools if t.name == tc["name"]), None)
        result = tool.invoke(tc["args"]) if tool else f"Unknown tool: {tc['name']}"
        chat_messages.append(ToolMessage(content=str(result), tool_call_id=tc["id"]))

    # Step 2: loop until the model writes a final plain-text answer
    while True:
        response = llm_with_tools.invoke(chat_messages)
        chat_messages.append(response)

        if not response.tool_calls:
            break

        for tc in response.tool_calls:
            tool = next((t for t in available_tools if t.name == tc["name"]), None)
            result = tool.invoke(tc["args"]) if tool else f"Unknown tool: {tc['name']}"
            chat_messages.append(ToolMessage(content=str(result), tool_call_id=tc["id"]))

    return {
        "messages": messages + [AIMessage(content=response.content)],
        "next": "supervisor",
        "status": "researcher_decision",
    }

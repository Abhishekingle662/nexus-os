# backend/app/agents/researcher.py
from openai import OpenAI
from langchain_core.messages import AIMessage
from ..core.trace_queue import live_events
from typing import Dict

openai_client = OpenAI()

def researcher_node(state: Dict):
    task = state.get("task", "")
    messages = state.get("messages", [])

    live_events.put({"type": "agent_start", "agent": "researcher"})
    live_events.put({
        "type": "tool_call",
        "agent": "researcher",
        "tool": "web_search",
        "args": {"query": task},
    })

    try:
        response = openai_client.responses.create(
            model="o4-mini-deep-research",
            input=task,
            tools=[{"type": "web_search_preview"}],
        )

        final_text = ""
        search_count = 0
        for item in response.output:
            item_type = getattr(item, "type", None)
            if item_type == "web_search_call":
                search_count += 1
            elif item_type == "message":
                for part in getattr(item, "content", []):
                    if getattr(part, "type", None) == "output_text":
                        final_text += getattr(part, "text", "")

        live_events.put({
            "type": "tool_result",
            "agent": "researcher",
            "tool": "web_search",
            "snippet": f"[{search_count} web search{'es' if search_count != 1 else ''}]\n{final_text[:400]}",
            "ok": True,
        })

    except Exception as e:
        final_text = f"[Researcher] Research failed: {e}"
        live_events.put({
            "type": "tool_result",
            "agent": "researcher",
            "tool": "web_search",
            "snippet": str(e)[:300],
            "ok": False,
        })

    return {
        "messages": messages + [AIMessage(content=final_text or "[Researcher] No content returned.")],
        "next": "supervisor",
        "status": "researcher_decision",
    }

# backend/app/agents/tools.py
from langchain_core.tools import tool
from langchain_community.tools import DuckDuckGoSearchRun
import subprocess
import os
from typing import Dict, Any

search_tool = DuckDuckGoSearchRun()

@tool
def web_search(query: str) -> str:
    """Search the web for up-to-date information."""
    return search_tool.run(query)

@tool
def save_code_to_file(filename: str, code: str) -> str:
    """Save generated code to a file in the generated folder."""
    try:
        os.makedirs("generated", exist_ok=True)
        filepath = f"generated/{filename}"
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(code)
        return f"✅ Code successfully saved to: {filepath}"
    except Exception as e:
        return f"❌ Failed to save file: {str(e)}"

@tool
def execute_code(filename: str) -> str:
    """Execute a Python file from the generated folder and return output."""
    try:
        filepath = f"generated/{filename}"
        result = subprocess.run(
            ["python", filepath],
            capture_output=True,
            text=True,
            timeout=10
        )
        output = f"STDOUT:\n{result.stdout}\n"
        if result.stderr:
            output += f"STDERR:\n{result.stderr}"
        return output.strip()
    except Exception as e:
        return f"❌ Execution error: {str(e)}"

available_tools = [web_search, save_code_to_file, execute_code]
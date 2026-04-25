from langchain_core.tools import tool
import subprocess
from pathlib import Path
from typing import Optional

GENERATED_DIR = Path(__file__).resolve().parent.parent / "generated"
GENERATED_DIR.mkdir(exist_ok=True)

try:
    from langchain_community.tools import DuckDuckGoSearchRun
except Exception:
    DuckDuckGoSearchRun = None

search_tool: Optional[object] = None


def _get_search_tool():
    global search_tool
    if search_tool is None:
        if DuckDuckGoSearchRun is None:
            raise ImportError("DuckDuckGoSearchRun is unavailable. Install langchain-community and ddgs.")
        search_tool = DuckDuckGoSearchRun()
    return search_tool

@tool
def web_search(query: str) -> str:
    """Search the web for up-to-date information."""
    try:
        return _get_search_tool().run(query)
    except Exception as e:
        return f"Web search unavailable: {str(e)}"

@tool
def execute_code(code: str) -> str:
    """Execute Python code in a sandbox and return output."""
    try:
        # Very basic sandbox - improve with docker/exec in production
        result = subprocess.run(
            ["python", "-c", code],
            capture_output=True,
            text=True,
            timeout=10
        )
        return f"STDOUT:\n{result.stdout}\nSTDERR:\n{result.stderr}"
    except Exception as e:
        return f"Error: {str(e)}"

@tool
def save_code_to_file(filename: str, code: str) -> str:
    """Save generated code to a file for the project."""
    try:
        path = GENERATED_DIR / filename
        path.write_text(code, encoding="utf-8")
        return f"Code saved to {path}\n\n{code}"
    except Exception as e:
        return f"Failed to save: {str(e)}"

@tool
def read_file(filename: str) -> str:
    """Read a file from the generated project."""
    try:
        return (GENERATED_DIR / filename).read_text(encoding="utf-8")
    except Exception as e:
        return f"Error reading file: {str(e)}"

available_tools = [web_search, execute_code, save_code_to_file, read_file]
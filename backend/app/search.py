# app/search.py
"""
Web search functionality for chat modes.

Supports DuckDuckGo instant answers API with two modes:
- Manual search: always search before calling the LLM
- Agentic search: LLM decides when to search via tool calling (requires two LLM
  calls – one for the tool decision and one for the final response – so latency
  is higher than manual search.  LlamaCpp providers degrade gracefully to a
  plain web-search call instead.)
"""
import json
import logging
from typing import Any, Dict, List, Optional, Tuple

import httpx

logger = logging.getLogger("chat_backend.search")

# Default timeout for DuckDuckGo requests (seconds)
WEB_SEARCH_TIMEOUT = 10

# Tool definition for agentic search (OpenAI function-calling format)
SEARCH_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "web_search",
            "description": "Search the web for current or recent information",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "The search query"}
                },
                "required": ["query"],
            },
        },
    }
]


async def web_search(query: str) -> str:
    """
    Search DuckDuckGo instant answers API.

    Returns up to 5 relevant text snippets (1 Abstract + up to 4 RelatedTopics)
    joined by blank lines, or "No results found." when the API returns nothing useful.
    """
    try:
        async with httpx.AsyncClient(timeout=WEB_SEARCH_TIMEOUT) as client:
            r = await client.get(
                "https://api.duckduckgo.com/",
                params={"q": query, "format": "json", "no_html": 1, "skip_disambig": 1},
            )
            data = r.json()
            results: List[str] = []
            if data.get("Abstract"):
                results.append(data["Abstract"])
            for topic in data.get("RelatedTopics", [])[:4]:
                if isinstance(topic, dict) and "Text" in topic:
                    results.append(topic["Text"])
            return "\n\n".join(results) if results else "No results found."
    except Exception as e:
        logger.error(f"Web search failed for query '{query}': {e}")
        return "Search unavailable."


async def agentic_search(
    query: str,
    messages: List[Dict[str, Any]],
    openai_client: Any,
) -> Tuple[Optional[str], List[Dict[str, Any]]]:
    """
    Attempt tool-calling agentic search using LangChain bind_tools.

    Returns ``(search_context, messages)`` where *search_context* is the web
    search result string (or ``None`` if the LLM decided not to search), and
    *messages* is the original message list (unchanged – the caller injects the
    context into the system prompt rather than appending tool messages).

    Falls back to a plain ``web_search`` call when:
    - The provider is LlamaCpp (no tool-calling support in the tiny models)
    - LangChain is unavailable
    - The LLM response contains no tool calls
    - Any unexpected error occurs
    """
    try:
        # Only EnhancedOpenAIClient (Ollama / OpenAI via LangChain) supports bind_tools.
        from app.openai_client import EnhancedOpenAIClient

        if not isinstance(openai_client, EnhancedOpenAIClient):
            logger.info("Agentic search: non-LangChain provider – falling back to manual search")
            return await web_search(query), messages

        try:
            from langchain_core.messages import HumanMessage, SystemMessage
        except ImportError:
            logger.warning("LangChain not available for tool calling – falling back to manual search")
            return await web_search(query), messages

        # Build LangChain message list from the plain-dict messages
        lc_messages = []
        for msg in messages:
            role = msg.get("role", "user")
            content = msg.get("content", "")
            if role == "system":
                lc_messages.append(SystemMessage(content=content))
            elif role == "user":
                lc_messages.append(HumanMessage(content=content))

        # Bind tools and make a non-streaming call to let the LLM decide
        llm_with_tools = openai_client.llm.bind_tools(SEARCH_TOOLS)
        response = await llm_with_tools.ainvoke(lc_messages)

        tool_calls = getattr(response, "tool_calls", None)
        if not tool_calls:
            logger.info("Agentic search: LLM did not request a tool call")
            return None, messages

        # Execute requested tool calls
        search_results: List[str] = []
        for tool_call in tool_calls:
            fn_name = tool_call.get("name") if isinstance(tool_call, dict) else getattr(tool_call, "name", None)
            fn_args = tool_call.get("args") if isinstance(tool_call, dict) else getattr(tool_call, "args", {})
            if fn_name == "web_search":
                search_query = fn_args.get("query", query) if isinstance(fn_args, dict) else query
                result = await web_search(search_query)
                search_results.append(result)
                logger.info(f"Agentic search: executed web_search('{search_query}')")

        if search_results:
            return "\n\n".join(search_results), messages

        return None, messages

    except Exception as e:
        logger.error(f"Agentic search failed ({e}), falling back to manual web search")
        return await web_search(query), messages

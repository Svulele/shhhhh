from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
import httpx
import json
import os
import requests
import time
from pathlib import Path
from json import JSONDecodeError

router = APIRouter()

class Message(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    model: str = "anthropic/claude-sonnet-4-5"
    max_tokens: int = 1024
    system: str = ""
    messages: list[Message]

PERSONALITIES = {
    "friendly": "You are a friendly, warm and encouraging study partner.",
    "strict": "You are a strict but fair study coach. Be direct and no-nonsense.",
    "calm": "You are a calm, wise mentor. Be thoughtful and measured.",
    "hype": "You are an energetic hype partner! Use lots of energy and enthusiasm!",
}

FREE_MODEL_CACHE_TTL_SECONDS = 600
_free_models_cache: list[str] = []
_free_models_cache_expires_at = 0.0


def load_api_key() -> str:
    env_key = os.getenv("OPENROUTER_API_KEY", "").strip()
    if env_key:
        return env_key

    key_path = Path(__file__).resolve().parents[1] / "key.env"
    if not key_path.exists():
        return ""

    raw = key_path.read_text(encoding="utf-8").strip()
    if not raw:
        return ""

    if "=" in raw:
        k, v = raw.split("=", 1)
        if k.strip() in {"OPENROUTER_API_KEY", "API_KEY"}:
            return v.strip().strip('"').strip("'")

    return raw.strip().strip('"').strip("'")


def extract_error_message(data: object, status_code: int) -> str:
    error_msg = f"Status {status_code}: "
    if isinstance(data, dict):
        if "error" in data:
            error_obj = data["error"]
            if isinstance(error_obj, dict):
                error_msg += error_obj.get("message", str(error_obj))
                if "metadata" in error_obj:
                    error_msg += f" | {error_obj['metadata']}"
            else:
                error_msg += str(error_obj)
        else:
            error_msg += str(data)
    else:
        error_msg += str(data)
    return error_msg


def looks_like_unavailable_model(error_msg: str, status_code: int) -> bool:
    text = error_msg.lower()
    return status_code in {400, 404} and (
        "no endpoints found" in text
        or "model not found" in text
        or "does not exist" in text
        or "unsupported model" in text
    )


def expects_json_response(request: ChatRequest) -> bool:
    combined = f"{request.system_prompt or ''}\n{request.message or ''}".lower()
    return "json" in combined and (
        "respond only" in combined
        or "reply only" in combined
        or "no markdown" in combined
    )


def extract_first_json_payload(text: str) -> Optional[str]:
    decoder = json.JSONDecoder()
    for i, ch in enumerate(text):
        if ch not in "[{":
            continue
        try:
            parsed, end = decoder.raw_decode(text[i:])
        except JSONDecodeError:
            continue
        if isinstance(parsed, (dict, list)):
            return json.dumps(parsed)
    return None


def normalize_reply(reply: str, request: ChatRequest) -> str:
    cleaned = reply.strip()
    if not expects_json_response(request):
        return cleaned

    direct = cleaned.replace("```json", "").replace("```", "").strip()
    try:
        parsed = json.loads(direct)
        if isinstance(parsed, (dict, list)):
            return json.dumps(parsed)
    except JSONDecodeError:
        pass

    extracted = extract_first_json_payload(cleaned)
    if extracted:
        return extracted

    return cleaned


async def fetch_free_models(client: httpx.AsyncClient, headers: dict[str, str]) -> list[str]:
    try:
        res = await client.get("https://openrouter.ai/api/v1/models", headers=headers, timeout=20)
        if res.status_code != 200:
            return []
        payload = res.json()
        data = payload.get("data", []) if isinstance(payload, dict) else []
        models = []
        for item in data:
            if not isinstance(item, dict):
                continue
            model_id = item.get("id")
            if isinstance(model_id, str) and model_id.endswith(":free"):
                models.append(model_id)
        return models
    except Exception:
        return []


async def get_cached_free_models(client: httpx.AsyncClient, headers: dict[str, str]) -> list[str]:
    global _free_models_cache, _free_models_cache_expires_at

    now = time.monotonic()
    if _free_models_cache and now < _free_models_cache_expires_at:
        return _free_models_cache

    models = await fetch_free_models(client, headers)
    if models:
        _free_models_cache = models
        _free_models_cache_expires_at = now + FREE_MODEL_CACHE_TTL_SECONDS

    return models

@router.post("")
def chat(request: ChatRequest):
    api_key = load_api_key()
    if not api_key:
        raise HTTPException(
            status_code=400,
            detail="No backend API key found. Set OPENROUTER_API_KEY in Render environment variables or add key.env file.",
        )

    payload = {
        "model": "anthropic/claude-sonnet-4-5",
        "max_tokens": request.max_tokens,
        "messages": [{"role": m.role, "content": m.content} for m in request.messages],
    }
    if request.system:
        payload["messages"] = [{"role": "system", "content": request.system}] + payload["messages"]

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://shhhhh-ten.vercel.app",
        "X-Title": "Shhhhh Study Buddy",
    }

    response = requests.post("https://openrouter.ai/api/v1/chat/completions", json=payload, headers=headers)
    try:
        data = response.json()
    except ValueError:
        raise HTTPException(status_code=502, detail="Invalid response from OpenRouter")

    if response.status_code != 200:
        detail = data.get("error") or data.get("detail") or response.text
        raise HTTPException(status_code=502, detail=f"OpenRouter error: {detail}")

    return {
        "content": [{"type": "text", "text": data["choices"][0]["message"]["content"]}]
    }

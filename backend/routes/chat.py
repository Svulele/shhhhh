from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
import json
import os
import requests
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

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
DEFAULT_MODEL = os.getenv("OPENROUTER_MODEL", "openrouter/auto").strip() or "openrouter/auto"
MODEL_FALLBACKS = [
    DEFAULT_MODEL,
    "openrouter/auto",
    "nvidia/nemotron-3-super-120b-a12b:free",
]


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
    return status_code in {400, 402, 404, 429} and (
        "no endpoints found" in text
        or "model not found" in text
        or "does not exist" in text
        or "unsupported model" in text
        or "credit" in text
        or "billing" in text
        or "quota" in text
        or "rate limit" in text
    )


def expects_json_response(request: ChatRequest) -> bool:
    combined = "\n".join([request.system, *[m.content for m in request.messages]]).lower()
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


def model_candidates(requested: str) -> list[str]:
    candidates = [requested, *MODEL_FALLBACKS]
    seen = set()
    ordered = []
    for model in candidates:
        clean = (model or "").strip()
        if clean and clean not in seen:
            seen.add(clean)
            ordered.append(clean)
    return ordered

@router.post("")
def chat(request: ChatRequest):
    api_key = load_api_key()
    if not api_key:
        raise HTTPException(
            status_code=400,
            detail="No backend API key found. Set OPENROUTER_API_KEY in Render environment variables.",
        )

    messages = [{"role": m.role, "content": m.content} for m in request.messages]
    if request.system:
        messages = [{"role": "system", "content": request.system}] + messages

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://shhhhh-ten.vercel.app",
        "X-Title": "Shhhhh Study Buddy",
    }

    last_error = ""
    for model in model_candidates(request.model):
        payload = {
            "model": model,
            "max_tokens": request.max_tokens,
            "messages": messages,
        }
        try:
            response = requests.post(OPENROUTER_URL, json=payload, headers=headers, timeout=45)
            try:
                data = response.json()
            except ValueError:
                last_error = "Invalid response from OpenRouter"
                continue

            if response.status_code == 200:
                reply = data["choices"][0]["message"]["content"]
                return {"content": [{"type": "text", "text": normalize_reply(reply, request)}]}

            last_error = extract_error_message(data, response.status_code)
            if not looks_like_unavailable_model(last_error, response.status_code):
                break
        except requests.RequestException as exc:
            last_error = str(exc)
            continue

    raise HTTPException(status_code=502, detail=f"OpenRouter error: {last_error or 'No response'}")

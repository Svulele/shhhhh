from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field, ConfigDict, model_validator
from typing import Optional, Literal
import json
import logging
from security import require_user
import os
import requests
from json import JSONDecodeError

router = APIRouter()

class Message(BaseModel):
    model_config = ConfigDict(extra="forbid")
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=16000)

class ChatRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    model: str = Field(default="openrouter/auto", max_length=120)
    max_tokens: int = Field(default=1024, ge=1, le=2048)
    system: str = Field(default="", max_length=40000)
    messages: list[Message] = Field(min_length=1, max_length=16)

    @model_validator(mode="after")
    def bounded_context(self):
        if len(self.system) + sum(len(message.content) for message in self.messages) > 64000:
            raise ValueError("Selected context is too large")
        return self

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
    "meta-llama/llama-3.3-70b-instruct:free",
    "nvidia/nemotron-3-super-120b-a12b:free",
]


def load_api_key() -> str:
    return os.getenv("OPENROUTER_API_KEY", "").strip()


def extract_error_message(data: object, status_code: int) -> str:
    error_msg = f"Status {status_code}: "
    if isinstance(data, dict):
        if "error" in data:
            error_obj = data["error"]
            if isinstance(error_obj, dict):
                error_msg += str(error_obj.get("message") or error_obj)
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
def chat(request: ChatRequest, user_id: str = Depends(require_user)):
    api_key = load_api_key()
    if not api_key:
        raise HTTPException(
            status_code=400,
            detail="AI is temporarily unavailable. Please try again later.",
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
    for model in model_candidates(DEFAULT_MODEL)[:2]:
        payload = {
            "model": model,
            "max_tokens": request.max_tokens,
            "messages": messages,
            "provider": {"data_collection": "deny"},
        }
        try:
            response = requests.post(OPENROUTER_URL, json=payload, headers=headers, timeout=45)
            try:
                data = response.json()
            except ValueError:
                last_error = "Invalid response from OpenRouter"
                continue

            if response.status_code == 200:
                choices = data.get("choices") if isinstance(data, dict) else None
                message = choices[0].get("message", {}) if isinstance(choices, list) and choices and isinstance(choices[0], dict) else {}
                reply = message.get("content") if isinstance(message, dict) else None
                if isinstance(reply, list):
                    reply = "\n".join(part.get("text", "") for part in reply if isinstance(part, dict) and isinstance(part.get("text"), str))
                if not isinstance(reply, str) or not reply.strip():
                    last_error = "The AI provider returned no answer. Please try again."
                    continue
                return {"content": [{"type": "text", "text": normalize_reply(reply, request)}]}

            last_error = extract_error_message(data, response.status_code)
            if status_code_is_auth_failure(response.status_code, last_error):
                break
            if not looks_like_unavailable_model(last_error, response.status_code):
                break
        except (KeyError, IndexError, TypeError, ValueError):
            logging.warning("Invalid AI provider response")
            last_error = "The AI provider returned an invalid response. Please try again."
            continue
        except requests.RequestException as exc:
            last_error = "AI provider connection failed"
            continue

    raise HTTPException(status_code=502, detail="The AI service could not provide an answer. Please try again shortly.")


def status_code_is_auth_failure(status_code: int, error_msg: str) -> bool:
    text = error_msg.lower()
    return status_code in {401, 403} or "user not found" in text or "authentication" in text

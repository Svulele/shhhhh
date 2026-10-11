from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
import httpx
import json
import os
import time
from pathlib import Path

router = APIRouter()

class ChatRequest(BaseModel):
    message: str
    personality: Optional[str] = "friendly"
    material_context: Optional[str] = ""
    user_name: Optional[str] = "Sbulele"

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

@router.post("/")
async def chat(request: ChatRequest):
    api_key = load_api_key()
    if not api_key:
        raise HTTPException(
            status_code=400,
            detail="No backend API key found. Add OPENROUTER_API_KEY to backend/key.env",
        )

    try:
        personality = PERSONALITIES.get(request.personality, PERSONALITIES["friendly"])

        context = ""
        if request.material_context:
            context = f"\n\nThe student is studying this material:\n{request.material_context[:3000]}"

        system = f"{personality} The student's name is {request.user_name}. Help them study, answer questions, quiz them, or motivate them. Keep answers clear and concise.{context}"

        url = "https://openrouter.ai/api/v1/chat/completions"

        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": os.getenv("OPENROUTER_SITE_URL", "http://localhost:3000"),
            "X-Title": "Study Buddy App"
        }

        # Try models in order - use working free models
        models_to_try = [
            "nvidia/nemotron-3-super-120b-a12b:free",
            "qwen/qwen-2-7b-instruct:free",
            "meta-llama/codellama-34b-instruct:free",
        ]

        async with httpx.AsyncClient(timeout=15) as client:
            last_error = None
            for model in models_to_try:
                try:
                    payload = {
                        "model": model,
                        "messages": [
                            {"role": "system", "content": system},
                            {"role": "user", "content": request.message},
                        ],
                        "max_tokens": 450,
                    }
                    response = await client.post(url, json=payload, headers=headers)
                    print(f"[CHAT] Model={model} Status={response.status_code}")
                    
                    if response.status_code == 200:
                        data = response.json()
                        choices = data.get("choices", [])
                        if choices and "message" in choices[0]:
                            reply = choices[0]["message"].get("content", "")
                            if reply:
                                return {"reply": reply.strip()}
                    else:
                        error_text = response.text[:200]
                        last_error = f"{model}: HTTP {response.status_code} - {error_text}"
                        print(f"[CHAT] {last_error}")
                        
                except Exception as e:
                    last_error = f"{model}: {str(e)}"
                    print(f"[CHAT] Error with {model}: {str(e)}")
                    continue

            raise HTTPException(
                status_code=502,
                detail=f"No working models available. Last error: {last_error}",
            )

    except HTTPException:
        raise
    except Exception as e:
        import traceback
        print(f"[CHAT] Exception: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")

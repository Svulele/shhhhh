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

        preferred_models = [
            os.getenv("OPENROUTER_MODEL", "").strip(),
            "google/gemini-flash-1.5-8b:free",
            "meta-llama/llama-3.3-8b-instruct:free",
            "mistralai/mistral-small-3.1-24b-instruct:free",
            "qwen/qwen3-32b:free",
        ]
        preferred_models = [m for m in preferred_models if m]

        async with httpx.AsyncClient() as client:
            candidate_models = []
            for model in preferred_models:
                if model not in candidate_models:
                    candidate_models.append(model)
            if not candidate_models:
                discovered_models = await get_cached_free_models(client, headers)
                for model in discovered_models:
                    if model not in candidate_models:
                        candidate_models.append(model)
            if not candidate_models:
                raise HTTPException(status_code=502, detail="No free models found on OpenRouter.")

            last_error = "No response received from model provider."
            preferred_count = len(candidate_models)
            model_index = 0

            while model_index < min(len(candidate_models), 8):
                model = candidate_models[model_index]
                payload = {
                    "model": model,
                    "messages": [
                        {"role": "system", "content": system},
                        {"role": "user", "content": request.message},
                    ],
                    "max_tokens": 450,
                }
                response = await client.post(url, json=payload, headers=headers, timeout=60)
                print(f"Model={model} Status={response.status_code}")

                try:
                    data = response.json()
                except json.JSONDecodeError:
                    last_error = f"Invalid JSON from model {model}: {response.text[:250]}"
                    model_index += 1
                    continue

                if response.status_code == 200:
                    choices = data.get("choices", []) if isinstance(data, dict) else []
                    if choices and "message" in choices[0] and "content" in choices[0]["message"]:
                        reply = choices[0]["message"]["content"]
                        return {"reply": reply.strip()}
                    last_error = f"Model {model} returned no choices."
                    model_index += 1
                    continue

                error_msg = extract_error_message(data, response.status_code)
                last_error = f"{model}: {error_msg}"

                if looks_like_unavailable_model(error_msg, response.status_code):
                    model_index += 1
                    if model_index >= preferred_count and len(candidate_models) == preferred_count:
                        discovered_models = await get_cached_free_models(client, headers)
                        for discovered_model in discovered_models:
                            if discovered_model not in candidate_models:
                                candidate_models.append(discovered_model)
                    continue
                if response.status_code in {429, 500, 502, 503, 504}:
                    model_index += 1
                    if model_index >= preferred_count and len(candidate_models) == preferred_count:
                        discovered_models = await get_cached_free_models(client, headers)
                        for discovered_model in discovered_models:
                            if discovered_model not in candidate_models:
                                candidate_models.append(discovered_model)
                    continue

                model_index += 1

            raise HTTPException(
                status_code=502,
                detail=f"All model attempts failed. Last error: {last_error}",
            )

    except HTTPException:
        raise
    except Exception as e:
        import traceback
        print(f"Error: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")

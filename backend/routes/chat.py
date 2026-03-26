from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
import httpx

router = APIRouter()

class ChatRequest(BaseModel):
    message: str
    api_key: str
    personality: Optional[str] = "friendly"
    material_context: Optional[str] = ""
    user_name: Optional[str] = "Sbulele"

PERSONALITIES = {
    "friendly": "You are a friendly, warm and encouraging study partner.",
    "strict": "You are a strict but fair study coach. Be direct and no-nonsense.",
    "calm": "You are a calm, wise mentor. Be thoughtful and measured.",
    "hype": "You are an energetic hype partner! Use lots of energy and enthusiasm!",
}

@router.post("/")
async def chat(request: ChatRequest):
    if not request.api_key:
        raise HTTPException(status_code=400, detail="No API key. Paste your Gemini key in Settings.")

    try:
        personality = PERSONALITIES.get(request.personality, PERSONALITIES["friendly"])

        context = ""
        if request.material_context:
            context = f"\n\nThe student is studying this material:\n{request.material_context[:3000]}"

        system = f"{personality} The student's name is {request.user_name}. Help them study, answer questions, quiz them, or motivate them. Keep answers clear and concise.{context}"

        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={request.api_key}"

        payload = {
            "system_instruction": {
                "parts": [{"text": system}]
            },
            "contents": [
                {"parts": [{"text": request.message}]}
            ]
        }

        async with httpx.AsyncClient() as client:
            response = await client.post(url, json=payload, timeout=30)
            data = response.json()

        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail=str(data))

        reply = data["candidates"][0]["content"]["parts"][0]["text"]
        return {"reply": reply}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")
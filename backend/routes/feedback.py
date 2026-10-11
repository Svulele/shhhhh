import os
import re
import requests
from fastapi import APIRouter, Header, HTTPException, Request
from pydantic import BaseModel, ConfigDict, Field
from security import SUPABASE_URL, public_key, rate_limit

router = APIRouter()
class Feedback(BaseModel):
    model_config = ConfigDict(extra='forbid')
    message: str = Field(min_length=3, max_length=4000)
    reply_email: str = Field(default='', max_length=254)
    website: str = Field(default='', max_length=200)
    consent: bool
    captcha_token: str = Field(default='', max_length=2048)

@router.post('')
def feedback(data: Feedback, request: Request, x_supabase_key: str = Header(default='')):
    rate_limit('feedback:' + (request.client.host if request.client else 'unknown'), 5, 3600)
    if data.website:
        raise HTTPException(400, 'Could not submit this form.')
    if not data.consent or not data.message.strip():
        raise HTTPException(422, 'Please confirm permission to send your message.')
    if data.reply_email and not re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+', data.reply_email):
        raise HTTPException(422, 'Enter a valid reply email or leave it blank.')
    secret = os.getenv('TURNSTILE_SECRET_KEY', '')
    if secret:
        try:
            check = requests.post('https://challenges.cloudflare.com/turnstile/v0/siteverify', data={'secret':secret,'response':data.captcha_token}, timeout=10)
            result = check.json()
            if check.status_code != 200 or not result.get('success') or result.get('hostname') not in os.getenv('TURNSTILE_HOSTNAMES','shhhhh-ten.vercel.app').split(','):
                raise HTTPException(400, 'Security check failed. Please try again.')
        except (requests.RequestException, ValueError, TypeError, AttributeError):
            raise HTTPException(503, 'Security check is unavailable. Please try again later.') from None
    key = os.getenv('SUPABASE_SERVICE_ROLE_KEY', '') or public_key(x_supabase_key)
    message = data.message.strip() + (f'\nReply requested: {data.reply_email}' if data.reply_email else '')
    headers = {'apikey': key, 'Content-Type': 'application/json', 'Prefer': 'return=minimal'}
    if key.count('.') == 2:
        headers['Authorization'] = 'Bearer ' + key
    try:
        response = requests.post(SUPABASE_URL + '/rest/v1/feedback', headers=headers, json={'message': message, 'name': 'Anonymous', 'user_id': None}, timeout=15)
        if response.status_code not in (200, 201, 204):
            raise HTTPException(503, 'Feedback is temporarily unavailable. Please try again later.')
    except requests.RequestException:
        raise HTTPException(503, 'Feedback is temporarily unavailable. Please try again later.') from None
    return {'status': 'received'}

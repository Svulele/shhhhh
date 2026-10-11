"""Server-side identity checks and bounded, per-process abuse limits."""
import os
import time
from collections import OrderedDict, deque
from threading import Lock
from uuid import UUID
import requests
from fastapi import Header, HTTPException, Request

# Public project identifier, never a service-role key. Override when moving projects.
SUPABASE_URL = os.getenv('SUPABASE_URL', 'https://ftslqohbpbpussqfpynu.supabase.co').rstrip('/')
_lock = Lock()
_buckets = OrderedDict()

def rate_limit(key: str, limit: int, seconds: int):
    now = time.monotonic()
    with _lock:
        queue = _buckets.setdefault(key, deque())
        while queue and queue[0] <= now - seconds:
            queue.popleft()
        if len(queue) >= limit:
            raise HTTPException(429, 'Too many requests. Please try again later.', headers={'Retry-After': str(max(1, int(seconds - (now - queue[0]))))})
        queue.append(now)
        _buckets.move_to_end(key)
        while len(_buckets) > 10000:
            _buckets.popitem(last=False)

def public_key(value: str | None) -> str:
    key = os.getenv('SUPABASE_ANON_KEY', '') or value or ''
    if not key or len(key) > 2048:
        raise HTTPException(503, 'Account verification is unavailable.')
    return key

def require_user(request: Request, authorization: str = Header(default=''), x_supabase_key: str = Header(default='')) -> str:
    rate_limit('auth:' + (request.client.host if request.client else 'unknown'), 40, 60)
    if not authorization.startswith('Bearer ') or len(authorization) > 8192:
        raise HTTPException(401, 'Please sign in to use AI features.')
    if not SUPABASE_URL.startswith('https://'):
        raise HTTPException(503, 'Account verification is unavailable.')
    try:
        response = requests.get(SUPABASE_URL + '/auth/v1/user', headers={'apikey': public_key(x_supabase_key), 'Authorization': authorization}, timeout=10)
        if response.status_code != 200:
            raise HTTPException(401, 'Your session has expired. Please sign in again.')
        user = response.json()
        uid = str(UUID(user['id']))
        if user.get('is_anonymous') or not user.get('email_confirmed_at'):
            raise HTTPException(403, 'A verified account is required.')
    except (requests.RequestException, ValueError, KeyError, TypeError):
        raise HTTPException(503, 'Account verification is temporarily unavailable.') from None
    rate_limit('ai-minute:' + uid, 12, 60)
    rate_limit('ai-day:' + uid, 120, 86400)
    return uid

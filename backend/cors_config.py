"""Preview CORS is opt-in on non-production backends; production stays explicit."""
import os

PREVIEW_ORIGIN_PATTERN = r"^https://shhhhh-[a-z0-9-]+-svulele\.vercel\.app$"
NON_PRODUCTION = {"development", "test", "preview", "staging"}


def cors_settings(environment=None):
    env = os.environ if environment is None else environment
    mode = env.get("APP_ENV", "production").strip().lower()
    origins = ["https://shhhhh-ten.vercel.app"]
    origins += [f"http://{host}:{port}" for host in ("localhost", "127.0.0.1") for port in (5173, 5174, 5175)]
    origins += [value.strip().rstrip("/") for value in env.get("FRONTEND_ORIGINS", "").split(",") if value.strip() and value.strip() != "*"]
    return {"allow_origins": list(dict.fromkeys(origins)), "allow_origin_regex": PREVIEW_ORIGIN_PATTERN if mode in NON_PRODUCTION else None}

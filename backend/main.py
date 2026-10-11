from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from routes import chat, feedback
import os

app = FastAPI(title="Shhhh API", version="1.0.0", docs_url=None, redoc_url=None, openapi_url=None)

default_origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5174",
    "http://localhost:5175",
    "http://127.0.0.1:5175",
]
extra_origins = []
for origin in os.getenv("FRONTEND_ORIGINS", "").split(","):
    clean = origin.strip().rstrip("/")
    if clean:
        extra_origins.append(clean)

allowed_origins = list(dict.fromkeys(default_origins + ["https://shhhhh-ten.vercel.app"] + extra_origins))

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,

    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Legacy shared SQLite upload/progress routes are intentionally not exposed.
# Current PDFs, notes and reading position are local to each browser.
app.include_router(chat.router, prefix="/api/chat", tags=["chat"])
app.include_router(feedback.router, prefix="/api/feedback", tags=["feedback"])

@app.middleware("http")
async def safety_headers(request: Request, call_next):
    if request.method == "POST" and request.url.path.startswith("/api/"):
        size = 0
        chunks = []
        async for chunk in request.stream():
            size += len(chunk)
            chunks.append(chunk)
            if size > 262144:
                return JSONResponse({"detail": "Request is too large."}, status_code=413)
        request._body = b"".join(chunks)
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Cache-Control"] = "no-store"
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Strict-Transport-Security"] = "max-age=31536000"
    return response

@app.exception_handler(RequestValidationError)
async def validation_error(request: Request, error: RequestValidationError):
    return JSONResponse({"detail": "Please check your request fields and size limits."}, status_code=422)

@app.get("/")
def root():
    return {"message": "Shhhh API is running 🚀"}

@app.get("/health")
def health():
    return {"status": "ok"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

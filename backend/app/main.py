from fastapi import FastAPI, Depends, Request
from fastapi.responses import JSONResponse
import traceback
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.ext.asyncio import AsyncSession
from app.api import deps
from app.core.config import settings
from app.api.v1.endpoints import auth, patients, clinical, lab, finance, appointments, documents, dashboard, settings as settings_endpoint, reports, system, integrations, audit, stock, ai_scribe, patient_report, lab_analysis

# ... (omitted headers)



from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from app.core.limiter import limiter
from sqlalchemy import text

from redis import asyncio as aioredis
from fastapi_cache import FastAPICache
from fastapi_cache.backends.redis import RedisBackend

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="UroLog EMR System Backend API",
    version="2.6.0",
    docs_url="/docs" if settings.ENVIRONMENT != "production" else None,
    redoc_url="/redoc" if settings.ENVIRONMENT != "production" else None,
    )

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    error_msg = traceback.format_exc()
    print(f"🔥 CRITICAL ERROR: {request.url}\n{error_msg}")
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal Server Error", "traceback": error_msg if settings.ENVIRONMENT != "production" else None},
    )

# Trust Nginx Proxy Headers (X-Forwarded-Proto, etc.)
from uvicorn.middleware.proxy_headers import ProxyHeadersMiddleware
app.add_middleware(ProxyHeadersMiddleware, trusted_hosts="*")

# Add Limiter to app state and register handler
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

# Origins for CORS
origins = [
    "http://localhost:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:3001",
    "http://0.0.0.0:3000",
    "https://eren.urolog.net.tr",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"], 
    allow_headers=["*"], 
)

app.include_router(auth.router, prefix=f"{settings.API_V1_STR}/auth", tags=["auth"])
app.include_router(patients.router, prefix=f"{settings.API_V1_STR}/patients", tags=["patients"])
app.include_router(clinical.router, prefix=f"{settings.API_V1_STR}/clinical", tags=["clinical"])
app.include_router(lab.router, prefix=f"{settings.API_V1_STR}/lab", tags=["lab"])
app.include_router(finance.router, prefix=f"{settings.API_V1_STR}/finance", tags=["finance"])
app.include_router(appointments.router, prefix=f"{settings.API_V1_STR}/appointments", tags=["appointments"])
app.include_router(documents.router, prefix=f"{settings.API_V1_STR}/documents", tags=["documents"])
app.include_router(dashboard.router, prefix=f"{settings.API_V1_STR}/dashboard", tags=["dashboard"])
app.include_router(settings_endpoint.router, prefix=f"{settings.API_V1_STR}/settings", tags=["settings"])
app.include_router(reports.router, prefix=f"{settings.API_V1_STR}/reports", tags=["reports"])
app.include_router(system.router, prefix=f"{settings.API_V1_STR}/system", tags=["system"])
app.include_router(integrations.router, prefix=f"{settings.API_V1_STR}/integrations", tags=["integrations"])
app.include_router(audit.router, prefix=f"{settings.API_V1_STR}/audit", tags=["audit"])
app.include_router(stock.router, prefix=f"{settings.API_V1_STR}/stock", tags=["stock"])
app.include_router(ai_scribe.router, prefix=f"{settings.API_V1_STR}/ai-scribe", tags=["ai-scribe"])
app.include_router(patient_report.router, prefix=f"{settings.API_V1_STR}/patient-report", tags=["patient-report"])
app.include_router(lab_analysis.router, prefix=f"{settings.API_V1_STR}/lab-analysis", tags=["lab-analysis"])

@app.on_event("startup")
async def startup_event():
    try:
        redis = aioredis.from_url(f"redis://{settings.REDIS_HOST}:{settings.REDIS_PORT}", encoding="utf8", decode_responses=True)
        # Check connection
        await redis.ping()
        FastAPICache.init(RedisBackend(redis), prefix="fastapi-cache")
        print(f"✅ Redis cache initialized on {settings.REDIS_HOST}:{settings.REDIS_PORT}")
    except Exception as e:
        print(f"⚠️ Warning: Redis is not available ({e}). Caching is disabled. System will run normally without cache.")
        # Initialize with dummy or null backend if possible, or just skip
        # FastAPICache handles missing initialization gracefully if decorator is used? 
        # Actually it's better to provide an InMemoryBackend for local dev if Redis fails
        from fastapi_cache.backends.inmemory import InMemoryBackend
        FastAPICache.init(InMemoryBackend(), prefix="fastapi-cache")
        print("ℹ️ Using InMemory cache as fallback.")

@app.get("/health")
async def health_check(db: AsyncSession = Depends(deps.get_db)):
    health_status = {
        "status": "ok",
        "mode": settings.ENVIRONMENT,
        "system": "EMR V2",
        "version": "2.6.0",
        "services": {
            "database": "unknown",
            "redis": "unknown"
        }
    }
    
    # 1. Check Database
    try:
        await db.execute(text("SELECT 1"))
        health_status["services"]["database"] = "online"
    except Exception as e:
        health_status["status"] = "error"
        health_status["services"]["database"] = f"offline: {str(e)}"

    # 2. Check Redis
    try:
        redis_conn = aioredis.from_url(f"redis://{settings.REDIS_HOST}:{settings.REDIS_PORT}")
        await redis_conn.ping()
        health_status["services"]["redis"] = "online"
        await redis_conn.close()
    except Exception as e:
        # We don't mark global status as error for Redis if it's optional, 
        # but for a health-check we should be honest.
        health_status["services"]["redis"] = f"offline: {str(e)}"

    if health_status["status"] != "ok":
        from fastapi import Response
        return Response(content=str(health_status), status_code=503)

    return health_status

from fastapi.staticfiles import StaticFiles
import os

# Ensure static directory exists
os.makedirs("static/documents", exist_ok=True)
os.makedirs("static/photos", exist_ok=True)
os.makedirs("static/imaging", exist_ok=True)
os.makedirs("static/ai_scribe_templates", exist_ok=True)

# SECURITY: Public static serving is disabled. 
# Files are now strictly served through authenticated API endpoints:
# - /api/v1/documents/download/{id}
# - /api/v1/clinical/photos/{id}/download
# app.mount("/static", StaticFiles(directory="static"), name="static")

# Trigger reload for endpoint update

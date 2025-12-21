from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pathlib import Path

from .routes import router
from .auth import router as auth_router
from .customers import router as customers_router
from .analytics import router as analytics_router
from .reports import router as reports_router
from .tasks import router as tasks_router

app = FastAPI(
    title="Invitewala Platform API",
    description="Wedding card personalization, distribution, and business management",
    version="2.0.0"
)

# CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create storage directories
STORAGE_DIR = Path("storage")
UPLOADS_DIR = STORAGE_DIR / "uploads"
OUTPUTS_DIR = STORAGE_DIR / "outputs"
PREVIEWS_DIR = STORAGE_DIR / "previews"

for d in [UPLOADS_DIR, OUTPUTS_DIR, PREVIEWS_DIR]:
    d.mkdir(parents=True, exist_ok=True)

# Serve static files
app.mount("/storage", StaticFiles(directory=str(STORAGE_DIR)), name="storage")

# Serve static assets from build
app.mount("/assets", StaticFiles(directory="frontend/dist/assets"), name="assets")

# Include routes
app.include_router(router, prefix="/api")
app.include_router(auth_router)  # Auth router already has /api/auth prefix
app.include_router(customers_router)  # Customers router has /api/customers prefix
app.include_router(analytics_router)  # Analytics router has /api/analytics prefix
app.include_router(reports_router)  # Reports router has /api/reports prefix
app.include_router(tasks_router)  # Tasks router has /api/tasks prefix


# SPA Catch-all (Serve index.html)
@app.get("/{full_path:path}")
async def serve_spa(full_path: str):
    return FileResponse("frontend/dist/index.html")

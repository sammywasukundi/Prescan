import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from .config import get_settings
from .errors import InferenceError
from .routes import health, predict

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title="PreScan Inference API",
        version="0.1.0",
        docs_url="/docs" if settings.enable_docs else None,
        redoc_url=None,
        openapi_url="/openapi.json" if settings.enable_docs else None,
    )

    @app.exception_handler(InferenceError)
    async def handle_inference_error(_: Request, exc: InferenceError) -> JSONResponse:
        return JSONResponse(status_code=exc.status_code, content={"error": {"code": exc.code, "message": exc.message}})

    @app.exception_handler(RequestValidationError)
    async def handle_validation_error(_: Request, exc: RequestValidationError) -> JSONResponse:
        return JSONResponse(
            status_code=422,
            content={"error": {"code": "invalid_request", "message": "Requête invalide."}},
        )

    app.include_router(health.router)
    app.include_router(predict.router)                    # POST /predict
    app.include_router(predict.router, prefix="/v1")      # alias versionné : POST /v1/predict
    return app


app = create_app()

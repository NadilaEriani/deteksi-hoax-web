import time
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from app.artifact_reader import (
    get_model_metrics,
    get_dataset_info,
    get_training_history,
)

from app.database import (
    init_db,
    insert_prediction,
    get_history,
    get_history_paginated,
    delete_prediction,
    get_statistics,
    get_weekly_trend,
)

from app.predictor import HoaxPredictor


BASE_DIR = Path(__file__).resolve().parent.parent
STATIC_DIR = BASE_DIR / "static"


app = FastAPI(
    title="Deteksi Hoaks API",
    description="API Deteksi Berita Hoaks",
    version="1.0.0",
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


init_db()


predictor_instance = None


class PredictionRequest(BaseModel):
    title: str
    content: str
    author: Optional[str] = None
    source: Optional[str] = None
    publication_date: Optional[str] = None
    url: Optional[str] = None


def get_predictor():
    global predictor_instance

    if predictor_instance is None:
        predictor_instance = HoaxPredictor()

    return predictor_instance


def to_dict(model_object):
    if hasattr(model_object, "model_dump"):
        return model_object.model_dump()

    return model_object.dict()


def serve_page(filename: str):
    page_path = STATIC_DIR / filename

    if not page_path.exists():
        raise HTTPException(
            status_code=404,
            detail=f"Halaman {filename} tidak ditemukan.",
        )

    return FileResponse(page_path)


@app.get("/")
def root():
    return RedirectResponse(url="/dashboard")


@app.get("/dashboard")
def dashboard_page():
    return serve_page("dashboard.html")


@app.get("/analisis-berita")
def analysis_page():
    return serve_page("analisis-berita.html")


@app.get("/statistik")
def statistics_page():
    return serve_page("statistik.html")


@app.get("/dataset-info")
def dataset_info_page():
    return serve_page("dataset-info.html")


@app.get("/api/health")
def health():
    try:
        predictor = get_predictor()
        predictor_status = predictor.get_status()
    except Exception as error:
        predictor_status = {
            "model_used": "Belum siap",
            "lstm_loaded": False,
            "lstm_error": str(error),
        }

    return {
        "success": True,
        "message": "Backend Deteksi Hoaks berjalan.",
        **predictor_status,
    }


@app.post("/api/predict")
def predict(payload: PredictionRequest):
    data = to_dict(payload)

    if not data.get("title") or not data.get("content"):
        raise HTTPException(
            status_code=400,
            detail="Judul berita dan konten berita wajib diisi.",
        )

    try:
        predictor = get_predictor()

        start_time = time.perf_counter()

        result = predictor.predict(
            title=data["title"],
            content=data["content"],
        )

        end_time = time.perf_counter()
        processing_time_seconds = round(end_time - start_time, 3)

        result["processing_time_seconds"] = processing_time_seconds

        prediction_id = insert_prediction(
            data,
            result,
            processing_time_seconds=processing_time_seconds,
        )

        return {
            "success": True,
            "id": prediction_id,
            **result,
        }

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Gagal melakukan prediksi: {str(error)}",
        )


@app.get("/api/history")
def history(
    limit: int = 10,
    page: int = 1,
    search: Optional[str] = None,
    period: str = "all",
    date_range: Optional[str] = Query(default=None, alias="range"),
):
    selected_period = date_range or period
    result = get_history_paginated(
        limit=limit,
        page=page,
        search=search or "",
        period=selected_period,
    )

    return {
        "success": True,
        "data": result["items"],
        "pagination": result["pagination"],
        "filters": result["filters"],
    }


@app.delete("/api/history/{prediction_id}")
def delete_history(prediction_id: int):
    deleted = delete_prediction(prediction_id)

    if not deleted:
        raise HTTPException(
            status_code=404,
            detail="Data riwayat tidak ditemukan.",
        )

    return {
        "success": True,
        "message": "Riwayat berhasil dihapus.",
    }


@app.get("/api/statistics")
def statistics():
    return {
        "success": True,
        "data": get_statistics(),
    }


@app.get("/api/dashboard")
def dashboard():
    return {
        "success": True,
        "statistics": get_statistics(),
        "weekly_trend": get_weekly_trend(),
        "latest": get_history(5),
    }


@app.get("/api/model-metrics")
def model_metrics():
    return {
        "success": True,
        "data": get_model_metrics(),
    }


@app.get("/api/dataset-info")
def dataset_info():
    return {
        "success": True,
        "data": get_dataset_info(),
    }


@app.get("/api/training-history")
def training_history():
    return {
        "success": True,
        "data": get_training_history(),
    }
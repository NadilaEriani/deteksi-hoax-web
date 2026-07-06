import json
import os
import sqlite3
from datetime import datetime, timedelta
from pathlib import Path

from app.artifact_reader import get_model_metrics, get_dataset_info


BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
DB_PATH = DATA_DIR / "hoax.db"
SAMPLE_HISTORY_PATH = BASE_DIR / "artifacts" / "sample_analysis_history.json"
MIN_SAMPLE_HISTORY_TOTAL = 30



def get_connection():
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def ensure_column(cursor, table_name: str, column_name: str, column_definition: str):
    cursor.execute(f"PRAGMA table_info({table_name})")
    columns = [row["name"] for row in cursor.fetchall()]

    if column_name not in columns:
        cursor.execute(
            f"ALTER TABLE {table_name} ADD COLUMN {column_name} {column_definition}"
        )



def normalize_percentage(value, default=0):
    try:
        number = float(value)
    except Exception:
        return float(default)

    return round(max(0.0, min(number, 100.0)), 2)


def build_sample_created_at(sample: dict, index: int):
    """Buat waktu analisis dinamis agar data demo selalu terlihat relevan."""

    now = datetime.now()

    if sample.get("created_at"):
        return str(sample.get("created_at"))

    try:
        days_ago = int(sample.get("days_ago", index % 30))
    except Exception:
        days_ago = index % 30

    time_value = str(sample.get("time", "09:00:00")).strip()

    try:
        hour, minute, second = [int(part) for part in time_value.split(":")[:3]]
    except Exception:
        hour, minute, second = 9, 0, 0

    created_date = now - timedelta(days=max(0, days_ago))
    created_date = created_date.replace(
        hour=max(0, min(hour, 23)),
        minute=max(0, min(minute, 59)),
        second=max(0, min(second, 59)),
        microsecond=0,
    )

    return created_date.strftime("%Y-%m-%d %H:%M:%S")


def load_sample_history():
    if not SAMPLE_HISTORY_PATH.exists():
        return []

    try:
        with SAMPLE_HISTORY_PATH.open("r", encoding="utf-8") as file:
            data = json.load(file)
    except Exception:
        return []

    if isinstance(data, dict):
        items = data.get("items", [])
    else:
        items = data

    if not isinstance(items, list):
        return []

    return items


def seed_sample_history_if_needed():
    """
    Isi riwayat demo otomatis saat database masih kosong/terlalu sedikit.

    Tujuannya agar hasil deploy Hugging Face tidak terlihat kosong setiap rebuild.
    Data hanya ditambahkan sampai total minimal 30 dan tidak menggandakan judul
    yang sudah ada.
    """

    seed_enabled = os.getenv("SEED_SAMPLE_HISTORY", "1").strip().lower()

    if seed_enabled in {"0", "false", "no", "off"}:
        return 0

    samples = load_sample_history()

    if not samples:
        return 0

    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT COUNT(*) AS total FROM predictions")
    total_predictions = int(cursor.fetchone()["total"] or 0)

    if total_predictions >= MIN_SAMPLE_HISTORY_TOTAL:
        conn.close()
        return 0

    cursor.execute("SELECT title FROM predictions")
    existing_titles = {
        str(row["title"] or "").strip().lower()
        for row in cursor.fetchall()
    }

    inserted = 0

    for index, sample in enumerate(samples):
        if total_predictions + inserted >= MIN_SAMPLE_HISTORY_TOTAL:
            break

        title = str(sample.get("title") or "").strip()
        content = str(sample.get("content") or "").strip()

        if not title or not content:
            continue

        title_key = title.lower()

        if title_key in existing_titles:
            continue

        label = str(sample.get("prediction_label") or sample.get("prediction") or "Fakta").strip()
        label_lower = label.lower()
        is_hoax = label_lower in {"hoaks", "hoax", "1", "true"}

        prediction_label = "Hoaks" if is_hoax else "Fakta"
        prediction_value = 1 if is_hoax else 0

        if is_hoax:
            hoax_probability = normalize_percentage(sample.get("hoax_probability"), 90)
            non_hoax_probability = normalize_percentage(
                sample.get("non_hoax_probability"),
                100 - hoax_probability,
            )
            confidence = normalize_percentage(sample.get("confidence"), hoax_probability)
        else:
            non_hoax_probability = normalize_percentage(sample.get("non_hoax_probability"), 90)
            hoax_probability = normalize_percentage(
                sample.get("hoax_probability"),
                100 - non_hoax_probability,
            )
            confidence = normalize_percentage(sample.get("confidence"), non_hoax_probability)

        cursor.execute("""
            INSERT INTO predictions (
                title,
                content,
                author,
                source,
                publication_date,
                url,
                prediction_label,
                prediction_value,
                confidence,
                hoax_probability,
                non_hoax_probability,
                processing_time_seconds,
                created_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            title,
            content,
            sample.get("author"),
            sample.get("source"),
            sample.get("publication_date"),
            sample.get("url"),
            prediction_label,
            prediction_value,
            confidence,
            hoax_probability,
            non_hoax_probability,
            float(sample.get("processing_time_seconds") or 0.42),
            build_sample_created_at(sample, index),
        ))

        existing_titles.add(title_key)
        inserted += 1

    conn.commit()
    conn.close()

    return inserted


def init_db():
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS predictions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT,
            content TEXT NOT NULL,
            author TEXT,
            source TEXT,
            publication_date TEXT,
            url TEXT,
            prediction_label TEXT NOT NULL,
            prediction_value INTEGER NOT NULL,
            confidence REAL NOT NULL,
            hoax_probability REAL NOT NULL,
            non_hoax_probability REAL NOT NULL,
            created_at TEXT NOT NULL
        )
    """)

    ensure_column(
        cursor,
        "predictions",
        "processing_time_seconds",
        "REAL DEFAULT 0"
    )

    conn.commit()
    conn.close()

    seed_sample_history_if_needed()


def insert_prediction(payload: dict, result: dict, processing_time_seconds: float = 0):
    conn = get_connection()
    cursor = conn.cursor()

    created_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    cursor.execute("""
        INSERT INTO predictions (
            title,
            content,
            author,
            source,
            publication_date,
            url,
            prediction_label,
            prediction_value,
            confidence,
            hoax_probability,
            non_hoax_probability,
            processing_time_seconds,
            created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        payload.get("title"),
        payload.get("content"),
        payload.get("author"),
        payload.get("source"),
        payload.get("publication_date"),
        payload.get("url"),
        result.get("prediction"),
        result.get("label"),
        result.get("confidence"),
        result.get("hoax_probability"),
        result.get("non_hoax_probability"),
        processing_time_seconds,
        created_at
    ))

    conn.commit()
    inserted_id = cursor.lastrowid
    conn.close()

    return inserted_id


def get_history(limit: int = 20):
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT *
        FROM predictions
        ORDER BY id DESC
        LIMIT ?
    """, (limit,))

    rows = cursor.fetchall()
    conn.close()

    return [dict(row) for row in rows]


def get_history_paginated(
    limit: int = 10,
    page: int = 1,
    search: str = "",
    period: str = "all",
):
    """Ambil riwayat analisis dengan pagination, filter waktu, dan pencarian."""

    try:
        limit = int(limit)
    except Exception:
        limit = 10

    try:
        page = int(page)
    except Exception:
        page = 1

    limit = max(1, min(limit, 100))
    page = max(1, page)

    allowed_periods = {"all", "today", "7days", "1month"}
    period = str(period or "all").strip().lower()

    if period in {"7", "7day", "7_day", "7_days", "week", "weekly"}:
        period = "7days"
    elif period in {"30", "30days", "30_days", "month", "monthly", "bulan"}:
        period = "1month"
    elif period not in allowed_periods:
        period = "all"

    where_clauses = []
    params = []

    today = datetime.now().date()

    if period == "today":
        where_clauses.append("date(substr(created_at, 1, 10)) = date(?)")
        params.append(today.strftime("%Y-%m-%d"))
    elif period == "7days":
        start_date = today - timedelta(days=6)
        where_clauses.append("date(substr(created_at, 1, 10)) BETWEEN date(?) AND date(?)")
        params.extend([start_date.strftime("%Y-%m-%d"), today.strftime("%Y-%m-%d")])
    elif period == "1month":
        start_date = today - timedelta(days=29)
        where_clauses.append("date(substr(created_at, 1, 10)) BETWEEN date(?) AND date(?)")
        params.extend([start_date.strftime("%Y-%m-%d"), today.strftime("%Y-%m-%d")])

    search = str(search or "").strip()

    if search:
        like_value = f"%{search}%"
        where_clauses.append("""
            (
                title LIKE ?
                OR content LIKE ?
                OR author LIKE ?
                OR source LIKE ?
                OR publication_date LIKE ?
                OR url LIKE ?
                OR prediction_label LIKE ?
                OR created_at LIKE ?
            )
        """)
        params.extend([like_value] * 8)

    where_sql = ""

    if where_clauses:
        where_sql = "WHERE " + " AND ".join(where_clauses)

    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute(
        f"""
        SELECT COUNT(*) AS total
        FROM predictions
        {where_sql}
        """,
        params,
    )

    total = int(cursor.fetchone()["total"])
    total_pages = max(1, (total + limit - 1) // limit)

    if page > total_pages:
        page = total_pages

    offset = (page - 1) * limit

    cursor.execute(
        f"""
        SELECT *
        FROM predictions
        {where_sql}
        ORDER BY id DESC
        LIMIT ? OFFSET ?
        """,
        [*params, limit, offset],
    )

    rows = cursor.fetchall()
    conn.close()

    return {
        "items": [dict(row) for row in rows],
        "pagination": {
            "page": page,
            "limit": limit,
            "total": total,
            "total_pages": total_pages,
            "has_previous": page > 1,
            "has_next": page < total_pages,
        },
        "filters": {
            "period": period,
            "search": search,
        },
    }


def delete_prediction(prediction_id: int):
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("DELETE FROM predictions WHERE id = ?", (prediction_id,))
    conn.commit()

    deleted = cursor.rowcount
    conn.close()

    return deleted > 0


def get_today_total():
    conn = get_connection()
    cursor = conn.cursor()

    today = datetime.now().strftime("%Y-%m-%d")

    cursor.execute("""
        SELECT COUNT(*) AS total
        FROM predictions
        WHERE substr(created_at, 1, 10) = ?
    """, (today,))

    total = cursor.fetchone()["total"]
    conn.close()

    return total


def get_average_processing_time():
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT AVG(processing_time_seconds) AS avg_time
        FROM predictions
        WHERE processing_time_seconds IS NOT NULL
    """)

    row = cursor.fetchone()
    conn.close()

    avg_time = row["avg_time"] if row and row["avg_time"] is not None else 0
    return round(float(avg_time), 3)


def get_weekly_trend():
    conn = get_connection()
    cursor = conn.cursor()

    today = datetime.now().date()
    start_date = today - timedelta(days=6)

    cursor.execute("""
        SELECT
            substr(created_at, 1, 10) AS date,
            prediction_value,
            COUNT(*) AS total
        FROM predictions
        WHERE date(substr(created_at, 1, 10)) BETWEEN date(?) AND date(?)
        GROUP BY substr(created_at, 1, 10), prediction_value
        ORDER BY date ASC
    """, (
        start_date.strftime("%Y-%m-%d"),
        today.strftime("%Y-%m-%d")
    ))

    rows = cursor.fetchall()
    conn.close()

    grouped = {}

    for row in rows:
        date_key = row["date"]

        if date_key not in grouped:
            grouped[date_key] = {
                "fakta": 0,
                "hoaks": 0
            }

        if int(row["prediction_value"]) == 1:
            grouped[date_key]["hoaks"] = int(row["total"])
        else:
            grouped[date_key]["fakta"] = int(row["total"])

    day_names = {
        0: "Sen",
        1: "Sel",
        2: "Rab",
        3: "Kam",
        4: "Jum",
        5: "Sab",
        6: "Min"
    }

    trend = []

    for i in range(7):
        current_date = start_date + timedelta(days=i)
        date_key = current_date.strftime("%Y-%m-%d")
        day_index = current_date.weekday()

        trend.append({
            "date": date_key,
            "day": day_names[day_index],
            "fakta": grouped.get(date_key, {}).get("fakta", 0),
            "hoaks": grouped.get(date_key, {}).get("hoaks", 0),
            "total": (
                grouped.get(date_key, {}).get("fakta", 0)
                + grouped.get(date_key, {}).get("hoaks", 0)
            )
        })

    return trend


def get_statistics():
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT COUNT(*) AS total FROM predictions")
    total = cursor.fetchone()["total"]

    cursor.execute("""
        SELECT COUNT(*) AS total
        FROM predictions
        WHERE prediction_value = 1
    """)
    hoax_total = cursor.fetchone()["total"]

    cursor.execute("""
        SELECT COUNT(*) AS total
        FROM predictions
        WHERE prediction_value = 0
    """)
    fakta_total = cursor.fetchone()["total"]

    conn.close()

    model_metrics = get_model_metrics()
    dataset_info = get_dataset_info()

    return {
        "total_predictions": total,
        "hoax_predictions": hoax_total,
        "fakta_predictions": fakta_total,
        "today_predictions": get_today_total(),
        "average_processing_time": get_average_processing_time(),

        "model_accuracy": model_metrics.get("accuracy", 99.39),
        "model_precision": model_metrics.get("precision", 99.39),
        "model_recall": model_metrics.get("recall", 99.39),
        "model_f1_score": model_metrics.get("f1_score", 99.39),
        "model_version": model_metrics.get("model_version", "v2.5.1"),
        "model_name": model_metrics.get("model_name"),
        "model_short_name": model_metrics.get("model_short_name"),
        "confusion_matrix": model_metrics.get("confusion_matrix", {}),

        "dataset_total": dataset_info.get("clean_total", 13069),
        "dataset_raw_total": dataset_info.get("raw_total", 16973),
        "dataset_fakta": dataset_info.get("non_hoax_total", 6592),
        "dataset_hoax": dataset_info.get("hoax_total", 6477),
        "dataset_fakta_percent": dataset_info.get("non_hoax_percent", 50.44),
        "dataset_hoax_percent": dataset_info.get("hoax_percent", 49.56),
        "train_total": dataset_info.get("train_total", 10455),
        "validation_total": dataset_info.get("validation_total", 1307),
        "test_total": dataset_info.get("test_total", 1307)
    }
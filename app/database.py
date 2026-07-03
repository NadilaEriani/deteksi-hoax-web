import sqlite3
from datetime import datetime, timedelta
from pathlib import Path

from app.artifact_reader import get_model_metrics, get_dataset_info


BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
DB_PATH = DATA_DIR / "hoax.db"


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
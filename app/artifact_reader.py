import json
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parent.parent
ARTIFACTS_DIR = BASE_DIR / "artifacts"


DEFAULT_MODEL_METRICS = {
    "model_name": "LSTM + IndoBERT + TF-IDF Calibration",
    "model_short_name": "LSTM + CNN",
    "model_version": "v2.5.1",
    "accuracy": 99.39,
    "precision": 99.39,
    "recall": 99.39,
    "f1_score": 99.39,
    "f1_macro": 99.39,
    "alpha_lstm": 0.83,
    "alpha_tfidf": 0.17,
    "hoax_threshold": 0.118,
    "confusion_matrix": {
        "tn": 656,
        "fp": 4,
        "fn": 4,
        "tp": 643
    },
    "test_total": 1307,
    "test_non_hoax": 660,
    "test_hoax": 647,
    "target_status": "BERHASIL"
}


DEFAULT_DATASET_INFO = {
    "dataset_name": "Indonesian Fact and Hoax Political News",
    "dataset_sources": [
        "TurnbackHoax",
        "Tempo"
    ],
    "raw_total": 16973,
    "clean_total": 13069,
    "non_hoax_total": 6592,
    "hoax_total": 6477,
    "non_hoax_percent": 50.44,
    "hoax_percent": 49.56,
    "train_total": 10455,
    "validation_total": 1307,
    "test_total": 1307,
    "features": [
        "Judul dan konten berita dalam Bahasa Indonesia",
        "Konten lengkap berita politik",
        "Label verifikasi Fakta/Hoaks",
        "Metadata tambahan sumber dan tanggal"
    ],
    "technologies": [
        "Deep Learning",
        "NLP",
        "LSTM",
        "BERT",
        "TF-IDF",
        "Logistic Regression",
        "PyTorch",
        "FastAPI"
    ],
    "label_mapping": {
        "0": "Fakta / Non-Hoaks",
        "1": "Hoaks"
    }
}


def read_json_file(filename: str, default_value: dict):
    file_path = ARTIFACTS_DIR / filename

    if not file_path.exists():
        return default_value

    try:
        with open(file_path, "r", encoding="utf-8") as file:
            return json.load(file)
    except Exception:
        return default_value


def get_model_metrics():
    return read_json_file("model_metrics.json", DEFAULT_MODEL_METRICS)


def get_dataset_info():
    return read_json_file("dataset_info.json", DEFAULT_DATASET_INFO)


def get_training_history():
    return read_json_file("training_history.json", {})
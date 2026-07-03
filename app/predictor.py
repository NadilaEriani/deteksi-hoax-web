import json
from pathlib import Path

import joblib
import numpy as np


BASE_DIR = Path(__file__).resolve().parent.parent
ARTIFACTS_DIR = BASE_DIR / "artifacts"


class HoaxPredictor:
    def __init__(self):
        self.model_config = self._load_json(ARTIFACTS_DIR / "model_config.json")
        self.blend_config = self._load_json(ARTIFACTS_DIR / "best_blend_config.json")

        self.tfidf_model_path = ARTIFACTS_DIR / "tfidf_logreg.pkl"

        if not self.tfidf_model_path.exists():
            raise FileNotFoundError(
                f"File model TF-IDF tidak ditemukan: {self.tfidf_model_path}"
            )

        self.tfidf_model = joblib.load(self.tfidf_model_path)
        self.threshold = 0.5

    def _load_json(self, path: Path):
        if not path.exists():
            return {}

        with open(path, "r", encoding="utf-8") as file:
            return json.load(file)

    def _prepare_text(self, title: str, content: str):
        title = title.strip() if title else ""
        content = content.strip() if content else ""

        combined_text = f"{title}. {content}".strip()
        return combined_text

    def predict(self, title: str, content: str):
        text = self._prepare_text(title, content)

        if not text:
            raise ValueError("Judul atau konten berita tidak boleh kosong.")

        if hasattr(self.tfidf_model, "predict_proba"):
            probabilities = self.tfidf_model.predict_proba([text])[0]

            if len(probabilities) < 2:
                raise ValueError("Model TF-IDF tidak memiliki dua kelas prediksi.")

            hoax_probability = float(probabilities[1])
            prediction_value = 1 if hoax_probability >= self.threshold else 0
        else:
            prediction_value = int(self.tfidf_model.predict([text])[0])
            hoax_probability = 1.0 if prediction_value == 1 else 0.0

        hoax_probability = float(np.clip(hoax_probability, 0.0, 1.0))
        non_hoax_probability = 1.0 - hoax_probability

        prediction = "Hoaks" if prediction_value == 1 else "Fakta"
        confidence = hoax_probability if prediction_value == 1 else non_hoax_probability

        return {
            "prediction": prediction,
            "label": prediction_value,
            "confidence": round(confidence * 100, 2),
            "hoax_probability": round(hoax_probability * 100, 2),
            "non_hoax_probability": round(non_hoax_probability * 100, 2),
            "lstm_hoax_probability": None,
            "tfidf_hoax_probability": round(hoax_probability * 100, 2),
            "alpha": None,
            "threshold": self.threshold,
            "model_used": "TF-IDF Logistic Regression"
        }
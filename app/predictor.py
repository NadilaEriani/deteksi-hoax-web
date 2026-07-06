import json
import re
import warnings
from pathlib import Path
from typing import Optional

import joblib
import numpy as np


BASE_DIR = Path(__file__).resolve().parent.parent
ARTIFACTS_DIR = BASE_DIR / "artifacts"


class HoaxPredictor:
    """Predictor deployment untuk model deteksi hoaks.

    Notebook training memakai pipeline:
    1. preprocessing teks,
    2. LSTM + IndoBERT,
    3. probabilitas TF-IDF Logistic Regression,
    4. blending probabilitas dengan alpha + threshold terbaik.

    Kode web sebelumnya hanya memakai TF-IDF mentah dengan threshold 0.5.
    Class ini mengembalikan pipeline web ke pipeline notebook. Jika dependency
    LSTM/IndoBERT belum tersedia di server, aplikasi tetap hidup memakai TF-IDF
    sebagai fallback agar halaman web tidak down.
    """

    def __init__(self):
        self.model_config = self._load_json(ARTIFACTS_DIR / "model_config.json")
        self.blend_config = self._load_json(ARTIFACTS_DIR / "best_blend_config.json")

        self.tfidf_model_path = ARTIFACTS_DIR / "tfidf_logreg.pkl"
        self.lstm_head_path = ARTIFACTS_DIR / "best_lstm_head.pt"

        if not self.tfidf_model_path.exists():
            raise FileNotFoundError(
                f"File model TF-IDF tidak ditemukan: {self.tfidf_model_path}"
            )

        self.tfidf_model = joblib.load(self.tfidf_model_path)

        self.alpha = float(self.blend_config.get("alpha", 1.0))
        self.blend_threshold = float(self.blend_config.get("threshold", 0.5))
        self.fallback_threshold = 0.5
        self.max_len = int(self.model_config.get("max_len", 128))

        self.device = None
        self.tokenizer = None
        self.lstm_model = None
        self.lstm_error: Optional[str] = None

        self._load_lstm_model()

    def _load_json(self, path: Path):
        if not path.exists():
            return {}

        with open(path, "r", encoding="utf-8") as file:
            return json.load(file)

    def _preprocess_text(self, text: str) -> str:
        """Samakan preprocessing dengan notebook training."""
        text = str(text or "").lower()
        text = re.sub(r"http\S+|www\S+|https\S+", "", text)
        text = re.sub(r"[^a-zA-Z\s]", " ", text)
        text = re.sub(r"\s+", " ", text).strip()
        return text

    def _prepare_text(self, title: str, content: str) -> str:
        title = title.strip() if title else ""
        content = content.strip() if content else ""
        combined_text = f"{title} {content}".strip()
        return self._preprocess_text(combined_text)

    def _load_lstm_model(self) -> None:
        if not self.lstm_head_path.exists():
            self.lstm_error = f"File model LSTM tidak ditemukan: {self.lstm_head_path}"
            return

        try:
            import torch
            from transformers import AutoModel, AutoTokenizer

            from app.model_architecture import LSTMHoaxClassifier

            self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

            bert_model_name = self.model_config.get(
                "bert_model_name",
                "indobenchmark/indobert-base-p1",
            )

            # Jika ingin deployment full offline, simpan file IndoBERT di:
            # artifacts/indobert-base-p1 lalu kode ini otomatis memakainya.
            local_bert_dir = ARTIFACTS_DIR / "indobert-base-p1"
            bert_source = str(local_bert_dir) if local_bert_dir.exists() else bert_model_name

            self.tokenizer = AutoTokenizer.from_pretrained(bert_source)
            bert_model = AutoModel.from_pretrained(bert_source).to(self.device)

            for param in bert_model.parameters():
                param.requires_grad = False

            self.lstm_model = LSTMHoaxClassifier(
                bert_model=bert_model,
                bert_hidden=int(self.model_config.get("bert_hidden", 768)),
                lstm_hidden=int(self.model_config.get("lstm_hidden", 256)),
                num_layers=int(self.model_config.get("num_layers", 2)),
                num_classes=int(self.model_config.get("num_classes", 2)),
                dropout=float(self.model_config.get("dropout", 0.3)),
                bidirectional=bool(self.model_config.get("bidirectional", True)),
            ).to(self.device)

            checkpoint = torch.load(self.lstm_head_path, map_location=self.device)
            state_dict = checkpoint.get("state_dict", checkpoint)

            # Export notebook hanya menyimpan head LSTM + FC, bukan bobot IndoBERT.
            # Karena itu strict=False wajib agar key IndoBERT yang tidak disimpan tidak dianggap error.
            self.lstm_model.load_state_dict(state_dict, strict=False)
            self.lstm_model.eval()
            self.lstm_model.bert.eval()
            self.lstm_error = None

        except Exception as error:
            self.lstm_model = None
            self.tokenizer = None
            self.device = None
            self.lstm_error = str(error)
            warnings.warn(
                "Model LSTM + IndoBERT gagal dimuat. "
                "Aplikasi memakai TF-IDF fallback. "
                f"Detail: {self.lstm_error}",
                RuntimeWarning,
            )

    def _predict_tfidf_hoax_probability(self, clean_text: str) -> float:
        if hasattr(self.tfidf_model, "predict_proba"):
            probabilities = self.tfidf_model.predict_proba([clean_text])[0]
            classes = list(getattr(self.tfidf_model, "classes_", []))

            if 1 in classes:
                hoax_index = classes.index(1)
            elif len(probabilities) >= 2:
                hoax_index = 1
            else:
                raise ValueError("Model TF-IDF tidak memiliki dua kelas prediksi.")

            return float(probabilities[hoax_index])

        prediction_value = int(self.tfidf_model.predict([clean_text])[0])
        return 1.0 if prediction_value == 1 else 0.0

    def _predict_lstm_hoax_probability(self, clean_text: str) -> Optional[float]:
        if self.lstm_model is None or self.tokenizer is None or self.device is None:
            return None

        import torch

        encoding = self.tokenizer(
            clean_text,
            max_length=self.max_len,
            padding="max_length",
            truncation=True,
            return_tensors="pt",
        )

        input_ids = encoding["input_ids"].to(self.device)
        attention_mask = encoding["attention_mask"].to(self.device)

        with torch.no_grad():
            outputs = self.lstm_model(input_ids, attention_mask)
            probabilities = torch.softmax(outputs, dim=1)[0]

        return float(probabilities[1].detach().cpu().item())

    def get_status(self):
        if self.lstm_model is not None:
            model_used = "LSTM + IndoBERT + TF-IDF Calibration"
        else:
            model_used = "TF-IDF Logistic Regression (fallback)"

        # Untuk tampilan website, keputusan akhir memakai probabilitas terbesar.
        # Threshold notebook (0.118) tetap disimpan sebagai informasi kalibrasi,
        # tetapi tidak dipakai sebagai batas label akhir karena dapat membuat
        # berita dengan 88% Fakta dan 11.96% Hoaks tetap ditandai Hoaks.
        active_threshold = 0.5

        return {
            "model_used": model_used,
            "lstm_loaded": self.lstm_model is not None,
            "lstm_error": self.lstm_error,
            "alpha": round(self.alpha, 4),
            "threshold": round(active_threshold, 4),
            "max_len": self.max_len,
        }

    def predict(self, title: str, content: str):
        clean_text = self._prepare_text(title, content)

        if not clean_text:
            raise ValueError("Judul atau konten berita tidak boleh kosong.")

        tfidf_hoax_probability = self._predict_tfidf_hoax_probability(clean_text)
        lstm_hoax_probability = self._predict_lstm_hoax_probability(clean_text)

        if lstm_hoax_probability is not None:
            hoax_probability = (
                (self.alpha * lstm_hoax_probability)
                + ((1.0 - self.alpha) * tfidf_hoax_probability)
            )
            threshold = self.blend_threshold
            model_used = "LSTM + IndoBERT + TF-IDF Calibration"
        else:
            hoax_probability = tfidf_hoax_probability
            threshold = self.fallback_threshold
            model_used = "TF-IDF Logistic Regression (fallback)"

        hoax_probability = float(np.clip(hoax_probability, 0.0, 1.0))
        non_hoax_probability = 1.0 - hoax_probability

        # Keputusan label akhir untuk website memakai probabilitas terbesar.
        # Sebelumnya memakai threshold kalibrasi notebook (misalnya 0.118), sehingga
        # kasus 88.04% Fakta dan 11.96% Hoaks tetap bisa keluar sebagai Hoaks.
        # Dengan threshold 0.5, label konsisten dengan probabilitas yang ditampilkan.
        decision_threshold = 0.5
        prediction_value = 1 if hoax_probability >= decision_threshold else 0
        prediction = "Hoaks" if prediction_value == 1 else "Fakta"
        confidence = hoax_probability if prediction_value == 1 else non_hoax_probability

        return {
            "prediction": prediction,
            "label": prediction_value,
            "confidence": round(confidence * 100, 2),
            "hoax_probability": round(hoax_probability * 100, 2),
            "non_hoax_probability": round(non_hoax_probability * 100, 2),
            "lstm_hoax_probability": (
                round(lstm_hoax_probability * 100, 2)
                if lstm_hoax_probability is not None
                else None
            ),
            "tfidf_hoax_probability": round(tfidf_hoax_probability * 100, 2),
            "alpha": round(self.alpha, 4) if lstm_hoax_probability is not None else None,
            "threshold": round(decision_threshold, 4),
            "calibration_threshold": round(threshold, 4),
            "model_used": model_used,
            "lstm_status": "loaded" if lstm_hoax_probability is not None else "fallback",
            "lstm_error": self.lstm_error if lstm_hoax_probability is None else None,
        }

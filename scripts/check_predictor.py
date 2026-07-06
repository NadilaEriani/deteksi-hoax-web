import sys
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parents[1]

if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))


from app.predictor import HoaxPredictor


def print_result(title, content, result):
    print("=" * 80)
    print("JUDUL:")
    print(title)
    print()
    print("ISI:")
    print(content)
    print()
    print("HASIL:")
    print(result)
    print("=" * 80)
    print()


def main():
    print("=== CHECK HOAX PREDICTOR ===")
    print(f"Project root: {ROOT_DIR}")

    try:
        predictor = HoaxPredictor()
        print("Predictor berhasil dimuat.")
    except Exception as e:
        print("Predictor gagal dimuat.")
        print(f"Error: {e}")
        return

    print()
    print("=== STATUS MODEL ===")

    try:
        status = predictor.get_status()
        for key, value in status.items():
            print(f"{key}: {value}")
    except Exception as e:
        print("Gagal membaca status model.")
        print(f"Error: {e}")

    print()
    print("=== TEST PREDIKSI ===")

    tests = [
        {
            "name": "Contoh Hoaks dari Notebook",
            "title": "Presiden Diam-diam Tandatangani Perjanjian Rahasia",
            "content": (
                "Presiden diam-diam tandatangani perjanjian rahasia yang menjual "
                "wilayah Indonesia ke negara asing tanpa sepengetahuan DPR dan rakyat."
            ),
        },
        {
            "name": "Contoh Non-Hoaks dari Notebook",
            "title": "Pemerintah Resmi Umumkan Kenaikan Anggaran Pendidikan",
            "content": (
                "Pemerintah resmi mengumumkan kenaikan anggaran pendidikan sebesar "
                "20 persen pada tahun anggaran 2025 untuk meningkatkan kualitas guru."
            ),
        },
        {
            "name": "Contoh Fakta Umum",
            "title": "Pemerintah Umumkan Jadwal Resmi Program Kesehatan Nasional",
            "content": (
                "Pemerintah mengumumkan jadwal resmi pelaksanaan program kesehatan "
                "berdasarkan keterangan dari kementerian terkait. Informasi ini "
                "disampaikan melalui kanal resmi dan dapat diverifikasi melalui "
                "sumber pemerintah."
            ),
        },
    ]

    for item in tests:
        print(f"TEST: {item['name']}")

        try:
            result = predictor.predict(item["title"], item["content"])
            print_result(item["title"], item["content"], result)
        except Exception as e:
            print("Prediksi gagal.")
            print(f"Error: {e}")
            print()


if __name__ == "__main__":
    main()
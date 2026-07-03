const precisionBar = document.getElementById("precisionBar");
const recallBar = document.getElementById("recallBar");
const f1Bar = document.getElementById("f1Bar");
const accuracyMetricBar = document.getElementById("accuracyMetricBar");

const datasetPie = document.getElementById("datasetPie");
const pieFaktaLabel = document.getElementById("pieFaktaLabel");
const pieHoaksLabel = document.getElementById("pieHoaksLabel");

const totalPredictions = document.getElementById("totalPredictions");
const averageAccuracy = document.getElementById("averageAccuracy");
const detectedHoaks = document.getElementById("detectedHoaks");
const processingTime = document.getElementById("processingTime");

const detailModalOverlay = document.getElementById("detailModalOverlay");
const detailModalTitle = document.getElementById("detailModalTitle");
const detailModalBody = document.getElementById("detailModalBody");
const detailModalClose = document.getElementById("detailModalClose");

let currentStatistics = {};
let currentMetrics = {};
let currentDataset = {};

function formatNumber(value) {
  const number = Number(value || 0);
  return number.toLocaleString("id-ID");
}

function formatPercent(value) {
  const number = Number(value || 0);
  return `${number.toFixed(2).replace(".00", "")}%`;
}

function formatProcessTime(value) {
  const number = Number(value || 0);

  if (number <= 0) {
    return "0s";
  }

  if (number < 1) {
    return `${number.toFixed(3).replace(/0+$/, "").replace(/\.$/, "")}s`;
  }

  return `${number.toFixed(2).replace(".00", "")}s`;
}

function clampPercent(value) {
  const number = Number(value || 0);
  return Math.min(Math.max(number, 0), 100);
}

async function loadStatisticsPage() {
  try {
    const statisticsResponse = await fetch("/api/statistics");
    const statisticsResult = await statisticsResponse.json();

    const metricsResponse = await fetch("/api/model-metrics");
    const metricsResult = await metricsResponse.json();

    const datasetResponse = await fetch("/api/dataset-info");
    const datasetResult = await datasetResponse.json();

    if (!statisticsResponse.ok || !statisticsResult.success) {
      throw new Error("Gagal mengambil statistik realtime.");
    }

    if (!metricsResponse.ok || !metricsResult.success) {
      throw new Error("Gagal mengambil metrik model.");
    }

    if (!datasetResponse.ok || !datasetResult.success) {
      throw new Error("Gagal mengambil informasi dataset.");
    }

    currentStatistics = statisticsResult.data || {};
    currentMetrics = metricsResult.data || {};
    currentDataset = datasetResult.data || {};

    renderMetricBars(currentMetrics);
    renderDatasetDistribution(currentDataset);
    renderSummaryCards(currentStatistics, currentMetrics);
    bindDetailEvents();
  } catch (error) {
    console.error(error);
  }
}

function renderMetricBars(metrics) {
  const precision = clampPercent(metrics.precision || 0);
  const recall = clampPercent(metrics.recall || 0);
  const f1Score = clampPercent(metrics.f1_score || 0);
  const accuracy = clampPercent(metrics.accuracy || 0);

  precisionBar.style.height = `${precision}%`;
  recallBar.style.height = `${recall}%`;
  f1Bar.style.height = `${f1Score}%`;
  accuracyMetricBar.style.height = `${accuracy}%`;

  precisionBar.title = `Precision: ${formatPercent(precision)}`;
  recallBar.title = `Recall: ${formatPercent(recall)}`;
  f1Bar.title = `F1-Score: ${formatPercent(f1Score)}`;
  accuracyMetricBar.title = `Accuracy: ${formatPercent(accuracy)}`;
}

function renderDatasetDistribution(dataset) {
  const faktaPercent = Number(dataset.non_hoax_percent || 0);
  const hoaksPercent = Number(dataset.hoax_percent || 0);

  const safeFaktaPercent = clampPercent(faktaPercent);
  const safeHoaksPercent = clampPercent(hoaksPercent);

  const faktaDegree = (safeFaktaPercent / 100) * 360;

  datasetPie.style.background = `
    conic-gradient(
      #18bf86 0deg ${faktaDegree}deg,
      #ff4047 ${faktaDegree}deg 360deg
    )
  `;

  pieFaktaLabel.textContent = formatPercent(safeFaktaPercent);
  pieHoaksLabel.textContent = formatPercent(safeHoaksPercent);
}

function renderSummaryCards(statistics, metrics) {
  const total = statistics.total_predictions || 0;
  const hoaks = statistics.hoax_predictions || 0;
  const accuracy = metrics.accuracy || statistics.model_accuracy || 0;
  const avgTime = statistics.average_processing_time || 0;

  totalPredictions.textContent = formatNumber(total);
  averageAccuracy.textContent = formatPercent(accuracy);
  detectedHoaks.textContent = formatNumber(hoaks);
  processingTime.textContent = formatProcessTime(avgTime);
}

function bindDetailEvents() {
  const detailTargets = document.querySelectorAll("[data-detail]");

  detailTargets.forEach((element) => {
    element.addEventListener("click", () => {
      showDetail(element.dataset.detail);
    });
  });
}

function showDetail(type) {
  const detailData = getDetailData(type);

  detailModalTitle.textContent = detailData.title;
  detailModalBody.innerHTML = detailData.body;
  detailModalOverlay.classList.add("show");
}

function closeDetail() {
  detailModalOverlay.classList.remove("show");
}

function getDetailData(type) {
  const precision = currentMetrics.precision || 0;
  const recall = currentMetrics.recall || 0;
  const f1Score = currentMetrics.f1_score || 0;
  const accuracy = currentMetrics.accuracy || 0;

  const totalPrediksi = currentStatistics.total_predictions || 0;
  const hoaksPrediksi = currentStatistics.hoax_predictions || 0;
  const faktaPrediksi = currentStatistics.fakta_predictions || 0;
  const waktuProses = currentStatistics.average_processing_time || 0;

  const totalDataset = currentDataset.clean_total || 0;
  const rawDataset = currentDataset.raw_total || 0;
  const faktaDataset = currentDataset.non_hoax_total || 0;
  const hoaksDataset = currentDataset.hoax_total || 0;
  const faktaPercent = currentDataset.non_hoax_percent || 0;
  const hoaksPercent = currentDataset.hoax_percent || 0;
  const trainTotal = currentDataset.train_total || 0;
  const validationTotal = currentDataset.validation_total || 0;
  const testTotal = currentDataset.test_total || 0;

  const modelName = currentMetrics.model_name || "Model Deteksi Hoaks";
  const modelVersion = currentMetrics.model_version || "-";
  const threshold = currentMetrics.hoax_threshold || "-";
  const alphaLstm = currentMetrics.alpha_lstm || "-";
  const alphaTfidf = currentMetrics.alpha_tfidf || "-";

  const confusionMatrix = currentMetrics.confusion_matrix || {};
  const tn = confusionMatrix.tn || 0;
  const fp = confusionMatrix.fp || 0;
  const fn = confusionMatrix.fn || 0;
  const tp = confusionMatrix.tp || 0;

  const metricDetails = {
    precision: {
      title: "Detail Precision",
      body: `
        <p>
          Precision menunjukkan seberapa tepat model ketika memberi label prediksi.
          Nilai ini berasal dari hasil evaluasi model di Colab.
        </p>
        ${detailRows([
          ["Precision", formatPercent(precision)],
          ["Model", modelName],
          ["Versi", modelVersion],
          ["Sumber Data", "artifacts/model_metrics.json"],
        ])}
      `,
    },
    recall: {
      title: "Detail Recall",
      body: `
        <p>
          Recall menunjukkan kemampuan model menangkap data pada kelas yang benar.
          Nilai ini berasal dari hasil evaluasi model di Colab.
        </p>
        ${detailRows([
          ["Recall", formatPercent(recall)],
          ["Model", modelName],
          ["Versi", modelVersion],
          ["Sumber Data", "artifacts/model_metrics.json"],
        ])}
      `,
    },
    f1: {
      title: "Detail F1-Score",
      body: `
        <p>
          F1-score adalah gabungan precision dan recall. Nilai ini membantu melihat
          performa model secara seimbang.
        </p>
        ${detailRows([
          ["F1-Score", formatPercent(f1Score)],
          ["Precision", formatPercent(precision)],
          ["Recall", formatPercent(recall)],
          ["Sumber Data", "artifacts/model_metrics.json"],
        ])}
      `,
    },
    accuracy: {
      title: "Detail Accuracy",
      body: `
        <p>
          Accuracy menunjukkan persentase prediksi benar dari keseluruhan data test
          pada evaluasi Colab.
        </p>
        ${detailRows([
          ["Accuracy", formatPercent(accuracy)],
          ["True Negative", formatNumber(tn)],
          ["False Positive", formatNumber(fp)],
          ["False Negative", formatNumber(fn)],
          ["True Positive", formatNumber(tp)],
        ])}
      `,
    },
  };

  const datasetDetails = {
    "dataset-pie": {
      title: "Detail Distribusi Dataset",
      body: `
        <p>
          Distribusi ini berasal dari data hasil preprocessing di Colab, bukan dari input user di web.
        </p>
        ${detailRows([
          ["Total Data Mentah", formatNumber(rawDataset)],
          ["Total Data Bersih", formatNumber(totalDataset)],
          [
            "Berita Fakta",
            `${formatNumber(faktaDataset)} (${formatPercent(faktaPercent)})`,
          ],
          [
            "Berita Hoaks",
            `${formatNumber(hoaksDataset)} (${formatPercent(hoaksPercent)})`,
          ],
          ["Train", formatNumber(trainTotal)],
          ["Validasi", formatNumber(validationTotal)],
          ["Test", formatNumber(testTotal)],
        ])}
      `,
    },
    "dataset-fakta": {
      title: "Detail Berita Fakta",
      body: `
        <p>
          Data fakta adalah data dengan label 0 atau Non-Hoaks pada dataset hasil Colab.
        </p>
        ${detailRows([
          ["Jumlah Berita Fakta", formatNumber(faktaDataset)],
          ["Persentase", formatPercent(faktaPercent)],
          ["Sumber Data", "artifacts/dataset_info.json"],
        ])}
      `,
    },
    "dataset-hoaks": {
      title: "Detail Berita Hoaks",
      body: `
        <p>
          Data hoaks adalah data dengan label 1 atau Hoaks pada dataset hasil Colab.
        </p>
        ${detailRows([
          ["Jumlah Berita Hoaks", formatNumber(hoaksDataset)],
          ["Persentase", formatPercent(hoaksPercent)],
          ["Sumber Data", "artifacts/dataset_info.json"],
        ])}
      `,
    },
  };

  const summaryDetails = {
    "total-predictions": {
      title: "Detail Total Prediksi",
      body: `
        <p>
          Total prediksi adalah jumlah berita yang sudah dianalisis melalui web ini.
          Data ini bersifat realtime dan tersimpan di database lokal.
        </p>
        ${detailRows([
          ["Total Prediksi Web", formatNumber(totalPrediksi)],
          ["Prediksi Fakta", formatNumber(faktaPrediksi)],
          ["Prediksi Hoaks", formatNumber(hoaksPrediksi)],
          ["Sumber Data", "data/hoax.db"],
        ])}
      `,
    },
    "average-accuracy": {
      title: "Detail Akurasi Rata-rata",
      body: `
        <p>
          Akurasi ini berasal dari hasil evaluasi model di Colab, bukan dihitung dari input user web.
        </p>
        ${detailRows([
          ["Accuracy", formatPercent(accuracy)],
          ["Threshold Hoaks", threshold],
          ["Alpha LSTM", alphaLstm],
          ["Alpha TF-IDF", alphaTfidf],
          ["Sumber Data", "artifacts/model_metrics.json"],
        ])}
      `,
    },
    "detected-hoaks": {
      title: "Detail Hoaks Terdeteksi",
      body: `
        <p>
          Hoaks terdeteksi adalah jumlah input user yang diprediksi sebagai Hoaks di aplikasi web.
        </p>
        ${detailRows([
          ["Hoaks Terdeteksi", formatNumber(hoaksPrediksi)],
          ["Total Prediksi Web", formatNumber(totalPrediksi)],
          ["Sumber Data", "data/hoax.db"],
        ])}
      `,
    },
    "processing-time": {
      title: "Detail Waktu Proses",
      body: `
        <p>
          Waktu proses adalah rata-rata durasi backend ketika memproses prediksi dari web.
        </p>
        ${detailRows([
          ["Rata-rata Waktu Proses", formatProcessTime(waktuProses)],
          ["Mode Prediksi Web", "TF-IDF Logistic Regression"],
          ["Sumber Data", "data/hoax.db"],
        ])}
      `,
    },
  };

  return (
    metricDetails[type] ||
    datasetDetails[type] ||
    summaryDetails[type] || {
      title: "Detail",
      body: "<p>Detail tidak tersedia.</p>",
    }
  );
}

function detailRows(rows) {
  return `
    <div class="detail-list">
      ${rows
        .map(
          ([label, value]) => `
            <div class="detail-row">
              <span>${escapeHtml(label)}</span>
              <strong>${escapeHtml(String(value))}</strong>
            </div>
          `,
        )
        .join("")}
    </div>
  `;
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

detailModalClose.addEventListener("click", closeDetail);

detailModalOverlay.addEventListener("click", (event) => {
  if (event.target === detailModalOverlay) {
    closeDetail();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeDetail();
  }
});

loadStatisticsPage();

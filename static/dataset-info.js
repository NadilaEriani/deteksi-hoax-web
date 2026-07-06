const datasetName = document.getElementById("datasetName");
const datasetDescription = document.getElementById("datasetDescription");
const datasetSource = document.getElementById("datasetSource");
const datasetSourceLink = document.getElementById("datasetSourceLink");

const datasetTotal = document.getElementById("datasetTotal");
const datasetFakta = document.getElementById("datasetFakta");
const datasetHoax = document.getElementById("datasetHoax");
const modelAccuracy = document.getElementById("modelAccuracy");

const featureList = document.getElementById("featureList");
const technologyTags = document.getElementById("technologyTags");

const KAGGLE_DATASET_URL =
  "https://www.kaggle.com/datasets/linkgish/indonesian-fact-and-hoax-political-news";

function formatNumber(value) {
  const number = Number(value || 0);
  return number.toLocaleString("id-ID");
}

function formatPercent(value) {
  const number = Number(value || 0);
  return `${number.toFixed(2).replace(".00", "")}%`;
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text ?? "";
  return div.innerHTML;
}

function setupDatasetLink(url = KAGGLE_DATASET_URL) {
  if (!datasetSourceLink) {
    return;
  }

  datasetSourceLink.href = url || KAGGLE_DATASET_URL;
  datasetSourceLink.target = "_blank";
  datasetSourceLink.rel = "noopener noreferrer";
  datasetSourceLink.style.color = "inherit";
  datasetSourceLink.style.textDecoration = "none";
}

async function loadDatasetInfo() {
  try {
    const datasetResponse = await fetch("/api/dataset-info");
    const datasetResult = await datasetResponse.json();

    const metricsResponse = await fetch("/api/model-metrics");
    const metricsResult = await metricsResponse.json();

    if (!datasetResponse.ok || !datasetResult.success) {
      throw new Error("Gagal mengambil informasi dataset.");
    }

    if (!metricsResponse.ok || !metricsResult.success) {
      throw new Error("Gagal mengambil metrik model.");
    }

    const dataset = datasetResult.data || {};
    const metrics = metricsResult.data || {};

    renderDatasetInfo(dataset, metrics);
  } catch (error) {
    console.error(error);
    setupDatasetLink();
  }
}

function renderDatasetInfo(dataset, metrics) {
  const sources = Array.isArray(dataset.dataset_sources)
    ? dataset.dataset_sources.join(" & ")
    : "TurnbackHoax & Tempo";

  const datasetUrl = dataset.dataset_url || KAGGLE_DATASET_URL;

  datasetName.textContent =
    dataset.dataset_name || "Indonesian Fact and Hoax Political News";

  datasetDescription.textContent =
    "Dataset ini berisi kumpulan berita politik Indonesia yang telah dilabeli sebagai fakta atau hoaks, digunakan untuk melatih model LSTM + IndoBERT + TF-IDF Calibration dalam mendeteksi berita palsu.";

  datasetSource.textContent = `Sumber: ${sources} (Kaggle)`;
  setupDatasetLink(datasetUrl);

  datasetTotal.textContent = formatNumber(dataset.clean_total || 13069);
  datasetFakta.textContent = formatNumber(dataset.non_hoax_total || 6592);
  datasetHoax.textContent = formatNumber(dataset.hoax_total || 6477);
  modelAccuracy.textContent = formatPercent(metrics.accuracy || 99.39);

  renderFeatures(dataset.features || []);
  renderTechnologies(dataset.technologies || []);
}

function renderFeatures(features) {
  if (!Array.isArray(features) || features.length === 0) {
    featureList.innerHTML = `
      <li>Judul dan konten berita dalam Bahasa Indonesia</li>
      <li>Konten lengkap berita politik</li>
      <li>Label verifikasi Fakta/Hoaks</li>
      <li>Metadata tambahan sumber dan tanggal</li>
    `;
    return;
  }

  featureList.innerHTML = features
    .map((feature) => `<li>${escapeHtml(feature)}</li>`)
    .join("");
}

function renderTechnologies(technologies) {
  if (!Array.isArray(technologies) || technologies.length === 0) {
    technologyTags.innerHTML = `
      <span>Deep Learning</span>
      <span>NLP</span>
      <span>LSTM</span>
      <span>BERT</span>
      <span>TF-IDF</span>
      <span>Logistic Regression</span>
      <span>PyTorch</span>
      <span>FastAPI</span>
    `;
    return;
  }

  technologyTags.innerHTML = technologies
    .map((technology) => `<span>${escapeHtml(technology)}</span>`)
    .join("");
}

loadDatasetInfo();

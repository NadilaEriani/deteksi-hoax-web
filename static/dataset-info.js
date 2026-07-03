const datasetName = document.getElementById("datasetName");
const datasetDescription = document.getElementById("datasetDescription");
const datasetSource = document.getElementById("datasetSource");

const datasetTotal = document.getElementById("datasetTotal");
const datasetFakta = document.getElementById("datasetFakta");
const datasetHoax = document.getElementById("datasetHoax");
const modelAccuracy = document.getElementById("modelAccuracy");

const featureList = document.getElementById("featureList");
const technologyTags = document.getElementById("technologyTags");

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
  div.textContent = text;
  return div.innerHTML;
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
  }
}

function renderDatasetInfo(dataset, metrics) {
  const sources = Array.isArray(dataset.dataset_sources)
    ? dataset.dataset_sources.join(" & ")
    : "TurnbackHoax & Tempo";

  datasetName.textContent =
    dataset.dataset_name || "Indonesian Fact and Hoax Political News";

  datasetDescription.textContent =
    "Dataset ini berisi kumpulan berita politik Indonesia yang telah dilabeli sebagai fakta atau hoaks, digunakan untuk melatih model deep learning dalam mendeteksi berita palsu.";

  datasetSource.textContent = `Sumber: ${sources}`;

  datasetTotal.textContent = formatNumber(dataset.clean_total || 0);
  datasetFakta.textContent = formatNumber(dataset.non_hoax_total || 0);
  datasetHoax.textContent = formatNumber(dataset.hoax_total || 0);
  modelAccuracy.textContent = formatPercent(metrics.accuracy || 0);

  renderFeatures(dataset.features || []);
  renderTechnologies(dataset.technologies || []);
}

function renderFeatures(features) {
  if (!Array.isArray(features) || features.length === 0) {
    featureList.innerHTML = `
      <li>Judul berita dalam Bahasa Indonesia</li>
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
      <span>PyTorch</span>
    `;
    return;
  }

  technologyTags.innerHTML = technologies
    .map((technology) => `<span>${escapeHtml(technology)}</span>`)
    .join("");
}

loadDatasetInfo();

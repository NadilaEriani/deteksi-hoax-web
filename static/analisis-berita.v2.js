const form = document.getElementById("predictionForm");
const titleInput = document.getElementById("title");
const contentInput = document.getElementById("content");
const authorInput = document.getElementById("author");
const sourceInput = document.getElementById("source");
const publicationDateInput = document.getElementById("publicationDate");
const urlInput = document.getElementById("url");

const analyzeBtn = document.getElementById("analyzeBtn");
const analyzeBtnText = document.getElementById("analyzeBtnText");
const charCounter = document.getElementById("charCounter");
const messageBox = document.getElementById("messageBox");
const resultBox = document.getElementById("resultBox");

const predictionLabel = document.getElementById("predictionLabel");
const confidenceValue = document.getElementById("confidenceValue");
const confidenceBar = document.getElementById("confidenceBar");
const factProbability = document.getElementById("factProbability");
const hoaxProbability = document.getElementById("hoaxProbability");

const historyList = document.getElementById("historyList");
const refreshHistoryBtn = document.getElementById("refreshHistoryBtn");
const historySearchInput = document.getElementById("historySearchInput");
const historySearchBtn = document.getElementById("historySearchBtn");
const historyClearBtn = document.getElementById("historyClearBtn");
const historyPeriodButtons = document.querySelectorAll("[data-history-period]");
const historyPrevBtn = document.getElementById("historyPrevBtn");
const historyNextBtn = document.getElementById("historyNextBtn");
const historyPageInfo = document.getElementById("historyPageInfo");
const historySummary = document.getElementById("historySummary");
const historyPagination = document.getElementById("historyPagination");

const factExampleBtn = document.getElementById("factExampleBtn");
const hoaxExampleBtn = document.getElementById("hoaxExampleBtn");

const datasetTotal = document.getElementById("datasetTotal");
const datasetFakta = document.getElementById("datasetFakta");
const datasetHoax = document.getElementById("datasetHoax");
const modelAccuracy = document.getElementById("modelAccuracy");

const KAGGLE_DATASET_URL =
  "https://www.kaggle.com/datasets/linkgish/indonesian-fact-and-hoax-political-news";

let historyData = [];
let historyState = {
  page: 1,
  limit: 10,
  total: 0,
  totalPages: 1,
  period: "all",
  search: "",
};

function validateForm() {
  const hasTitle = titleInput.value.trim().length > 0;
  const hasContent = contentInput.value.trim().length > 0;

  analyzeBtn.disabled = !(hasTitle && hasContent);
}

function updateCounter() {
  charCounter.textContent = `Jumlah karakter: ${contentInput.value.length}`;
}

function showMessage(message, type = "error") {
  messageBox.textContent = message;
  messageBox.className = `message-box ${type}`;
  messageBox.classList.remove("hidden");
}

function hideMessage() {
  messageBox.classList.add("hidden");
}

function setLoading(isLoading) {
  if (isLoading) {
    analyzeBtn.classList.add("loading");
    analyzeBtn.disabled = true;

    if (analyzeBtnText) {
      analyzeBtnText.textContent = "Menganalisis...";
    } else {
      analyzeBtn.textContent = "Menganalisis...";
    }
  } else {
    analyzeBtn.classList.remove("loading");

    if (analyzeBtnText) {
      analyzeBtnText.textContent = "Analisis Berita";
    } else {
      analyzeBtn.textContent = "Analisis Berita";
    }

    validateForm();
  }
}

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
    return "<1s";
  }

  if (number < 1) {
    return `${number.toFixed(3).replace(/0+$/, "").replace(/\.$/, "")}s`;
  }

  return `${number.toFixed(2).replace(".00", "")}s`;
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text ?? "";
  return div.innerHTML;
}

function shortText(text, maxLength = 260) {
  const value = String(text || "").trim();

  if (!value) {
    return "-";
  }

  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength)}...`;
}

function shortWords(text, maxWords = 5) {
  const words = String(text || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 0) {
    return "-";
  }

  if (words.length <= maxWords) {
    return words.join(" ");
  }

  return `${words.slice(0, maxWords).join(" ")}...`;
}

function getLabelClass(label) {
  return String(label || "").toLowerCase() === "hoaks" ? "hoaks" : "fakta";
}

function getSafeUrl(url) {
  const value = String(url || "").trim();

  if (!value) {
    return "";
  }

  if (value.startsWith("http://") || value.startsWith("https://")) {
    return value;
  }

  return "";
}

function ensureHistoryStyles() {
  if (document.getElementById("historyFilterStyle")) {
    return;
  }

  const style = document.createElement("style");
  style.id = "historyFilterStyle";
  style.textContent = `
    .dataset-tags {
      color: inherit;
      text-decoration: none;
    }

    .dataset-tags:hover span {
      text-decoration: underline;
    }

    .history-header small {
      display: block;
      margin-top: 5px;
      color: #6d8088;
      font-size: 12px;
      font-weight: 600;
    }

    .history-controls {
      display: grid;
      gap: 12px;
      margin-bottom: 16px;
    }

    .history-search-box {
      display: grid;
      grid-template-columns: 1fr auto auto;
      gap: 10px;
    }

    .history-search-box input {
      width: 100%;
      border: 1px solid #d4e1df;
      border-radius: 9px;
      padding: 11px 12px;
      font-size: 14px;
      color: #24333d;
      background: #ffffff;
    }

    .history-search-box input:focus {
      outline: none;
      border-color: #12b8a6;
      box-shadow: 0 0 0 3px rgba(18, 184, 166, 0.14);
    }

    .history-search-box button,
    .history-filter-tabs button,
    .history-pagination button {
      border: none;
      background: #edf8f6;
      color: #087e70;
      padding: 10px 13px;
      border-radius: 9px;
      cursor: pointer;
      font-weight: 900;
      transition: background 0.2s ease, transform 0.2s ease, opacity 0.2s ease;
    }

    .history-search-box button:hover,
    .history-filter-tabs button:hover,
    .history-pagination button:hover:not(:disabled) {
      background: #d9f4ef;
      transform: translateY(-1px);
    }

    .history-search-box button:first-of-type,
    .history-filter-tabs button.active {
      background: #087e70;
      color: #ffffff;
    }

    .history-filter-tabs {
      display: flex;
      flex-wrap: wrap;
      gap: 9px;
    }

    .history-pagination {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      margin-top: 16px;
    }

    .history-pagination button {
      width: 42px;
      height: 38px;
      padding: 0;
      font-size: 22px;
      line-height: 1;
    }

    .history-pagination button:disabled {
      opacity: 0.45;
      cursor: not-allowed;
      transform: none;
    }

    .history-pagination span {
      color: #52676f;
      font-size: 13px;
      font-weight: 800;
    }

    .history-preview-title {
      margin-bottom: 5px;
    }

    .history-preview-content {
      margin: 0;
      color: #52676f;
      font-size: 13px;
      line-height: 1.45;
    }

    .history-preview-body {
      min-width: 0;
    }

    .history-item .history-badge {
      justify-self: end;
      white-space: nowrap;
      min-width: 74px;
      text-align: center;
    }

    @media (max-width: 760px) {
      .history-search-box {
        grid-template-columns: 1fr;
      }

      .history-header {
        align-items: flex-start;
        gap: 12px;
      }
    }
  `;

  document.head.appendChild(style);
}

function ensureDetailModal() {
  if (document.getElementById("analysisDetailModal")) {
    return;
  }

  const style = document.createElement("style");
  style.id = "analysisDetailModalStyle";
  style.textContent = `
    .analysis-detail-overlay {
      position: fixed;
      inset: 0;
      background: rgba(9, 32, 36, 0.48);
      display: none;
      align-items: center;
      justify-content: center;
      padding: 22px;
      z-index: 99999;
    }

    .analysis-detail-overlay.show {
      display: flex;
    }

    .analysis-detail-modal {
      width: min(760px, 100%);
      max-height: 88vh;
      background: #ffffff;
      border-radius: 16px;
      box-shadow: 0 24px 70px rgba(0, 0, 0, 0.28);
      overflow: hidden;
      animation: analysisModalIn 0.2s ease;
    }

    @keyframes analysisModalIn {
      from {
        opacity: 0;
        transform: translateY(10px) scale(0.98);
      }

      to {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
    }

    .analysis-detail-header {
      padding: 18px 22px;
      border-bottom: 1px solid #e2efec;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      background: #f8fffd;
    }

    .analysis-detail-header h3 {
      font-size: 18px;
      color: #24333d;
      font-weight: 900;
      line-height: 1.35;
    }

    .analysis-detail-close {
      width: 36px;
      height: 36px;
      border: none;
      border-radius: 9px;
      background: #edf8f6;
      color: #087e70;
      cursor: pointer;
      font-size: 22px;
      line-height: 1;
      transition: background 0.2s ease, transform 0.2s ease;
      flex-shrink: 0;
    }

    .analysis-detail-close:hover {
      background: #d9f4ef;
      transform: rotate(90deg);
    }

    .analysis-detail-body {
      padding: 22px;
      overflow-y: auto;
      max-height: calc(88vh - 76px);
    }

    .analysis-detail-badges {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin-bottom: 16px;
    }

    .analysis-detail-badge {
      border-radius: 999px;
      padding: 8px 12px;
      font-size: 12px;
      font-weight: 900;
    }

    .analysis-detail-badge.fakta {
      background: #d9fbe8;
      color: #108847;
    }

    .analysis-detail-badge.hoaks {
      background: #ffdede;
      color: #d12f2f;
    }

    .analysis-detail-badge.neutral {
      background: #e9fffb;
      color: #087e70;
    }

    .analysis-detail-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 12px;
      margin-bottom: 16px;
    }

    .analysis-detail-row {
      background: #f6fffd;
      border: 1px solid #d9eeee;
      border-radius: 10px;
      padding: 12px;
      min-width: 0;
    }

    .analysis-detail-row span {
      display: block;
      font-size: 12px;
      color: #6d8088;
      margin-bottom: 5px;
      font-weight: 700;
    }

    .analysis-detail-row strong,
    .analysis-detail-row a {
      display: block;
      color: #263238;
      font-size: 14px;
      line-height: 1.45;
      overflow-wrap: anywhere;
      text-decoration: none;
    }

    .analysis-detail-row a:hover {
      color: #087e70;
      text-decoration: underline;
    }

    .analysis-detail-section {
      margin-top: 16px;
    }

    .analysis-detail-section h4 {
      font-size: 15px;
      color: #24333d;
      margin-bottom: 8px;
      font-weight: 900;
    }

    .analysis-detail-content {
      background: #fbfffe;
      border: 1px solid #d9eeee;
      border-radius: 12px;
      padding: 14px;
      color: #3c4f57;
      font-size: 14px;
      line-height: 1.7;
      white-space: pre-wrap;
      max-height: 220px;
      overflow-y: auto;
    }

    .analysis-detail-probability {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 12px;
      margin-top: 12px;
    }

    .analysis-prob-card {
      border-radius: 12px;
      padding: 13px;
      border: 1px solid #d9eeee;
      background: #ffffff;
    }

    .analysis-prob-card span {
      display: block;
      font-size: 12px;
      color: #6d8088;
      margin-bottom: 8px;
      font-weight: 800;
    }

    .analysis-prob-card strong {
      font-size: 20px;
      color: #263238;
    }

    .analysis-prob-line {
      margin-top: 8px;
      height: 8px;
      background: #dce9e6;
      border-radius: 999px;
      overflow: hidden;
    }

    .analysis-prob-line div {
      height: 100%;
      border-radius: 999px;
      transition: width 0.3s ease;
    }

    .analysis-prob-line .fakta {
      background: #10c469;
    }

    .analysis-prob-line .hoaks {
      background: #ff304f;
    }

    .history-item {
      cursor: pointer;
      transition:
        transform 0.2s ease,
        box-shadow 0.2s ease,
        border-color 0.2s ease,
        background 0.2s ease;
    }

    .history-item:hover {
      border-color: #9de6dd;
      background: #fbfffe;
      transform: translateY(-2px);
      box-shadow: 0 8px 16px rgba(0, 0, 0, 0.08);
    }

    .history-item:focus {
      outline: 3px solid rgba(18, 184, 166, 0.22);
      border-color: #12b8a6;
    }

    @media (max-width: 760px) {
      .analysis-detail-grid,
      .analysis-detail-probability {
        grid-template-columns: 1fr;
      }
    }
  `;

  document.head.appendChild(style);

  const modal = document.createElement("div");
  modal.id = "analysisDetailModal";
  modal.className = "analysis-detail-overlay";
  modal.innerHTML = `
    <div class="analysis-detail-modal" role="dialog" aria-modal="true">
      <div class="analysis-detail-header">
        <h3 id="analysisDetailTitle">Detail Analisis</h3>
        <button type="button" id="analysisDetailClose" class="analysis-detail-close">×</button>
      </div>
      <div id="analysisDetailBody" class="analysis-detail-body"></div>
    </div>
  `;

  document.body.appendChild(modal);

  document
    .getElementById("analysisDetailClose")
    .addEventListener("click", closeAnalysisDetail);

  modal.addEventListener("click", (event) => {
    if (event.target === modal) {
      closeAnalysisDetail();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeAnalysisDetail();
    }
  });
}

function openAnalysisDetail(item) {
  if (!item) {
    showMessage("Data detail riwayat tidak ditemukan.", "error");
    return;
  }

  ensureDetailModal();

  const modal = document.getElementById("analysisDetailModal");
  const titleElement = document.getElementById("analysisDetailTitle");
  const bodyElement = document.getElementById("analysisDetailBody");

  const title = item.title || "Tanpa judul";
  const content = item.content || "Konten berita tidak tersedia.";
  const label = item.prediction_label || "Fakta";
  const labelClass = getLabelClass(label);

  const confidence = Number(item.confidence || 0);
  const faktaProbability = Number(item.non_hoax_probability || 0);
  const hoaxProbability = Number(item.hoax_probability || 0);
  const processing = Number(item.processing_time_seconds || 0);
  const safeUrl = getSafeUrl(item.url);

  titleElement.textContent = title;

  bodyElement.innerHTML = `
    <div class="analysis-detail-badges">
      <span class="analysis-detail-badge ${labelClass}">
        ${escapeHtml(label.toUpperCase())}
      </span>

      <span class="analysis-detail-badge neutral">
        Confidence ${formatPercent(confidence)}
      </span>

      <span class="analysis-detail-badge neutral">
        Diproses ${formatProcessTime(processing)}
      </span>
    </div>

    <div class="analysis-detail-grid">
      <div class="analysis-detail-row">
        <span>Penulis / Author</span>
        <strong>${escapeHtml(item.author || "-")}</strong>
      </div>

      <div class="analysis-detail-row">
        <span>Sumber Media</span>
        <strong>${escapeHtml(item.source || "-")}</strong>
      </div>

      <div class="analysis-detail-row">
        <span>Tanggal Publikasi</span>
        <strong>${escapeHtml(item.publication_date || "-")}</strong>
      </div>

      <div class="analysis-detail-row">
        <span>Waktu Analisis</span>
        <strong>${escapeHtml(item.created_at || "-")}</strong>
      </div>

      <div class="analysis-detail-row">
        <span>URL Berita</span>
        ${
          safeUrl
            ? `<a href="${escapeHtml(safeUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(safeUrl)}</a>`
            : `<strong>-</strong>`
        }
      </div>

      <div class="analysis-detail-row">
        <span>ID Riwayat</span>
        <strong>#${escapeHtml(item.id || "-")}</strong>
      </div>
    </div>

    <div class="analysis-detail-section">
      <h4>Probabilitas Prediksi</h4>

      <div class="analysis-detail-probability">
        <div class="analysis-prob-card">
          <span>Probabilitas Fakta</span>
          <strong>${formatPercent(faktaProbability)}</strong>
          <div class="analysis-prob-line">
            <div class="fakta" style="width: ${Math.min(Math.max(faktaProbability, 0), 100)}%"></div>
          </div>
        </div>

        <div class="analysis-prob-card">
          <span>Probabilitas Hoaks</span>
          <strong>${formatPercent(hoaxProbability)}</strong>
          <div class="analysis-prob-line">
            <div class="hoaks" style="width: ${Math.min(Math.max(hoaxProbability, 0), 100)}%"></div>
          </div>
        </div>
      </div>
    </div>

    <div class="analysis-detail-section">
      <h4>Ringkasan Konten</h4>
      <div class="analysis-detail-content">${escapeHtml(shortText(content, 280))}</div>
    </div>

    <div class="analysis-detail-section">
      <h4>Isi Berita Lengkap</h4>
      <div class="analysis-detail-content">${escapeHtml(content)}</div>
    </div>
  `;

  modal.classList.add("show");
}

function closeAnalysisDetail() {
  const modal = document.getElementById("analysisDetailModal");

  if (modal) {
    modal.classList.remove("show");
  }
}

function renderResult(data) {
  resultBox.classList.remove("hidden");

  const label = data.prediction || "-";
  predictionLabel.textContent = label;
  predictionLabel.className = "";

  if (label.toLowerCase() === "hoaks") {
    predictionLabel.classList.add("hoaks");
  } else {
    predictionLabel.classList.add("fakta");
  }

  confidenceValue.textContent = `${data.confidence}%`;
  confidenceBar.style.width = `${data.confidence}%`;

  factProbability.textContent = `${data.non_hoax_probability}%`;
  hoaxProbability.textContent = `${data.hoax_probability}%`;
}

async function submitPrediction(event) {
  event.preventDefault();
  hideMessage();
  resultBox.classList.add("hidden");

  const payload = {
    title: titleInput.value.trim(),
    content: contentInput.value.trim(),
    author: authorInput.value.trim(),
    source: sourceInput.value.trim(),
    publication_date: publicationDateInput.value,
    url: urlInput.value.trim(),
  };

  if (!payload.title || !payload.content) {
    showMessage("Judul berita dan konten berita wajib diisi.");
    return;
  }

  try {
    setLoading(true);

    const response = await fetch("/api/predict", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.detail || "Prediksi gagal diproses.");
    }

    renderResult(data);
    showMessage("Analisis berhasil dilakukan.", "success");
    historyState.page = 1;
    await loadHistory();
  } catch (error) {
    showMessage(error.message || "Terjadi kesalahan saat melakukan prediksi.");
  } finally {
    setLoading(false);
  }
}

function buildHistoryUrl() {
  const params = new URLSearchParams();
  params.set("limit", String(historyState.limit));
  params.set("page", String(historyState.page));
  params.set("period", historyState.period || "all");

  if (historyState.search) {
    params.set("search", historyState.search);
  }

  return `/api/history?${params.toString()}`;
}

function updateHistoryControls(pagination = {}) {
  const page = Number(pagination.page || historyState.page || 1);
  const totalPages = Number(
    pagination.total_pages || historyState.totalPages || 1,
  );
  const total = Number(pagination.total || historyState.total || 0);
  const limit = Number(pagination.limit || historyState.limit || 10);

  historyState.page = page;
  historyState.totalPages = Math.max(1, totalPages);
  historyState.total = total;
  historyState.limit = limit;

  if (historyPrevBtn) {
    historyPrevBtn.disabled = page <= 1;
  }

  if (historyNextBtn) {
    historyNextBtn.disabled = page >= historyState.totalPages;
  }

  if (historyPageInfo) {
    historyPageInfo.textContent = `Halaman ${page} dari ${historyState.totalPages}`;
  }

  if (historyPagination) {
    historyPagination.style.display = total > limit ? "flex" : "none";
  }

  if (historySummary) {
    if (total === 0) {
      historySummary.textContent =
        "Tidak ada riwayat yang cocok dengan filter.";
    } else {
      const start = (page - 1) * limit + 1;
      const end = Math.min(page * limit, total);
      historySummary.textContent = `Menampilkan ${formatNumber(start)}-${formatNumber(end)} dari ${formatNumber(total)} riwayat.`;
    }
  }

  historyPeriodButtons.forEach((button) => {
    button.classList.toggle(
      "active",
      button.dataset.historyPeriod === historyState.period,
    );
  });
}

async function loadHistory() {
  try {
    const response = await fetch(buildHistoryUrl());
    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error("Gagal mengambil riwayat.");
    }

    const items = result.data || [];
    const pagination = result.pagination || {
      page: 1,
      limit: items.length || historyState.limit,
      total: items.length,
      total_pages: 1,
      has_previous: false,
      has_next: false,
    };

    historyData = items;
    updateHistoryControls(pagination);

    if (!items || items.length === 0) {
      historyList.innerHTML = `<p class="empty-history">Belum ada riwayat analisis yang cocok.</p>`;
      return;
    }

    historyList.innerHTML = items
      .map((item, index) => {
        const label = item.prediction_label || item.prediction || "Fakta";
        const labelClass = getLabelClass(label);
        const title = item.title || "Tanpa judul";
        const contentPreview = shortWords(item.content || "", 5);

        return `
          <div
            class="history-item"
            data-index="${index}"
            role="button"
            tabindex="0"
            title="Klik untuk melihat detail analisis"
          >
            <div class="history-preview-body">
              <h4 class="history-preview-title">${escapeHtml(title)}</h4>
              <p class="history-preview-content">${escapeHtml(contentPreview)}</p>
            </div>

            <span class="history-badge ${labelClass}">
              ${escapeHtml(label)}
            </span>
          </div>
        `;
      })
      .join("");
  } catch (error) {
    historyList.innerHTML = `<p class="empty-history">Gagal memuat riwayat.</p>`;
    updateHistoryControls({
      page: 1,
      limit: historyState.limit,
      total: 0,
      total_pages: 1,
    });
  }
}

function openHistoryDetailByIndex(index) {
  const item = historyData[Number(index)];
  openAnalysisDetail(item);
}

function handleInlineHistoryKeydown(event, index) {
  if (event.key !== "Enter" && event.key !== " ") {
    return;
  }

  event.preventDefault();
  openHistoryDetailByIndex(index);
}

function handleHistoryClick(event) {
  const itemElement = event.target.closest(".history-item[data-index]");

  if (!itemElement) {
    return;
  }

  const index = Number(itemElement.dataset.index);
  openHistoryDetailByIndex(index);
}

function handleHistoryKeyboard(event) {
  if (event.key !== "Enter" && event.key !== " ") {
    return;
  }

  const itemElement = event.target.closest(".history-item[data-index]");

  if (!itemElement) {
    return;
  }

  event.preventDefault();

  const index = Number(itemElement.dataset.index);
  openHistoryDetailByIndex(index);
}

async function loadStatistics() {
  try {
    const response = await fetch("/api/statistics");
    const result = await response.json();

    if (!response.ok || !result.success) {
      return;
    }

    const data = result.data;

    datasetTotal.textContent = formatNumber(data.dataset_total || 0);
    datasetFakta.textContent = formatNumber(data.dataset_fakta || 0);
    datasetHoax.textContent = formatNumber(data.dataset_hoax || 0);
    modelAccuracy.textContent = formatPercent(data.model_accuracy || 0);
  } catch (error) {
    return;
  }
}

function fillFactExample() {
  titleInput.value = "KPU menetapkan jadwal resmi pemungutan suara nasional";
  contentInput.value =
    "Komisi Pemilihan Umum menetapkan jadwal resmi pemungutan suara setelah melalui rapat pleno dan koordinasi dengan lembaga terkait. Informasi tersebut diumumkan melalui kanal resmi lembaga dan disertai dokumen keputusan yang dapat diakses publik.";
  authorInput.value = "Redaksi";
  sourceInput.value = "Media Nasional";
  publicationDateInput.value = "";
  urlInput.value = "";
  updateCounter();
  validateForm();
}

function fillHoaxExample() {
  titleInput.value =
    "Pemerintah membagikan uang tunai lewat tautan pesan berantai";
  contentInput.value =
    "Beredar pesan yang menyebutkan bahwa pemerintah membagikan bantuan uang tunai kepada seluruh masyarakat hanya dengan membuka tautan tertentu dan mengisi data pribadi. Pesan tersebut meminta pengguna menyebarkan tautan ke beberapa grup agar bantuan dapat dicairkan.";
  authorInput.value = "Pesan Berantai";
  sourceInput.value = "Media Sosial";
  publicationDateInput.value = "";
  urlInput.value = "";
  updateCounter();
  validateForm();
}

function applyHistorySearch() {
  historyState.search = historySearchInput
    ? historySearchInput.value.trim()
    : "";
  historyState.page = 1;
  loadHistory();
}

window.openHistoryDetailByIndex = openHistoryDetailByIndex;
window.handleInlineHistoryKeydown = handleInlineHistoryKeydown;

titleInput.addEventListener("input", validateForm);

contentInput.addEventListener("input", () => {
  updateCounter();
  validateForm();
});

form.addEventListener("submit", submitPrediction);
refreshHistoryBtn.addEventListener("click", loadHistory);
factExampleBtn.addEventListener("click", fillFactExample);
hoaxExampleBtn.addEventListener("click", fillHoaxExample);

historyList.addEventListener("click", handleHistoryClick);
historyList.addEventListener("keydown", handleHistoryKeyboard);

if (historySearchBtn) {
  historySearchBtn.addEventListener("click", applyHistorySearch);
}

if (historySearchInput) {
  historySearchInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      applyHistorySearch();
    }
  });
}

if (historyClearBtn) {
  historyClearBtn.addEventListener("click", () => {
    if (historySearchInput) {
      historySearchInput.value = "";
    }

    historyState.search = "";
    historyState.period = "all";
    historyState.page = 1;
    loadHistory();
  });
}

historyPeriodButtons.forEach((button) => {
  button.addEventListener("click", () => {
    historyState.period = button.dataset.historyPeriod || "all";
    historyState.page = 1;
    loadHistory();
  });
});

if (historyPrevBtn) {
  historyPrevBtn.addEventListener("click", () => {
    if (historyState.page <= 1) {
      return;
    }

    historyState.page -= 1;
    loadHistory();
  });
}

if (historyNextBtn) {
  historyNextBtn.addEventListener("click", () => {
    if (historyState.page >= historyState.totalPages) {
      return;
    }

    historyState.page += 1;
    loadHistory();
  });
}

ensureHistoryStyles();
ensureDetailModal();
updateCounter();
validateForm();
loadStatistics();
loadHistory();

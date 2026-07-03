const totalAnalysis = document.getElementById("totalAnalysis");
const totalFakta = document.getElementById("totalFakta");
const totalHoaks = document.getElementById("totalHoaks");
const modelAccuracy = document.getElementById("modelAccuracy");

const modelVersion = document.getElementById("modelVersion");
const modelTechnology = document.getElementById("modelTechnology");
const datasetInfo = document.getElementById("datasetInfo");
const processTime = document.getElementById("processTime");

const todayAccuracy = document.getElementById("todayAccuracy");
const todayProcessed = document.getElementById("todayProcessed");
const accuracyBar = document.getElementById("accuracyBar");
const latestAnalysisList = document.getElementById("latestAnalysisList");

const chartBars = document.querySelector(".chart-bars");
const chartYAxis = document.querySelector(".chart-y-axis");

let latestAnalysisData = [];

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

function shortText(text, maxLength = 120) {
  const value = String(text || "").trim();

  if (!value) {
    return "-";
  }

  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength)}...`;
}

function getLabelClass(label) {
  return String(label || "").toLowerCase() === "hoaks" ? "hoaks" : "fakta";
}

function injectDashboardEnhancementStyle() {
  if (document.getElementById("dashboardEnhancementStyle")) {
    return;
  }

  const style = document.createElement("style");
  style.id = "dashboardEnhancementStyle";
  style.textContent = `
    .chart-bars {
      align-items: end;
    }

    .bar-item {
      cursor: pointer;
      min-width: 0;
    }

    .bar-pair {
      width: 100%;
      height: calc(100% - 24px);
      display: flex;
      align-items: flex-end;
      justify-content: center;
      gap: 6px;
    }

    .bar {
      width: 18px;
      min-height: 0;
      border-radius: 4px 4px 0 0;
      transition:
        height 0.3s ease,
        transform 0.2s ease,
        box-shadow 0.2s ease,
        filter 0.2s ease;
    }

    .bar-fakta {
      background: #10b8aa;
    }

    .bar-hoaks {
      background: #ff3f46;
    }

    .bar-item:hover .bar {
      transform: scaleY(1.04);
      filter: brightness(1.04);
      box-shadow: 0 0 0 4px rgba(16, 184, 170, 0.08);
    }

    .bar-empty {
      width: 18px;
      height: 2px;
      background: #d7e7e4;
      border-radius: 999px;
    }

    .dashboard-latest-item {
      cursor: pointer;
    }

    .dashboard-latest-item:hover {
      border-color: #9de6dd;
      background: #fbfffe;
    }

    @media (max-width: 760px) {
      .bar-pair {
        gap: 4px;
      }

      .bar {
        width: 12px;
      }

      .bar-empty {
        width: 12px;
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
  style.textContent = `
    .analysis-detail-overlay {
      position: fixed;
      inset: 0;
      background: rgba(9, 32, 36, 0.48);
      display: none;
      align-items: center;
      justify-content: center;
      padding: 22px;
      z-index: 2000;
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
    }

    .analysis-prob-line .fakta {
      background: #10c469;
    }

    .analysis-prob-line .hoaks {
      background: #ff304f;
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
          item.url
            ? `<a href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.url)}</a>`
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
      <div class="analysis-detail-content">${escapeHtml(shortText(content, 260))}</div>
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

async function loadDashboard() {
  try {
    const response = await fetch("/api/dashboard");
    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error("Gagal mengambil data dashboard.");
    }

    const statistics = result.statistics || {};
    const weeklyTrend = result.weekly_trend || [];
    const latest = result.latest || [];

    renderDashboardStatistics(statistics);
    renderWeeklyTrend(weeklyTrend);
    renderLatestAnalysis(latest);
  } catch (error) {
    console.error(error);
    renderDashboardError();
  }
}

function renderDashboardStatistics(data) {
  const total = Number(data.total_predictions || 0);
  const fakta = Number(data.fakta_predictions || 0);
  const hoaks = Number(data.hoax_predictions || 0);

  const accuracy = Number(data.model_accuracy || 0);
  const todayTotal = Number(data.today_predictions || 0);
  const avgTime = Number(data.average_processing_time || 0);

  totalAnalysis.textContent = formatNumber(total);
  totalFakta.textContent = formatNumber(fakta);
  totalHoaks.textContent = formatNumber(hoaks);

  modelAccuracy.textContent = formatPercent(accuracy);
  todayAccuracy.textContent = formatPercent(accuracy);
  accuracyBar.style.width = `${Math.min(Math.max(accuracy, 0), 100)}%`;

  todayProcessed.textContent = `${formatNumber(todayTotal)} berita`;

  if (modelVersion) {
    modelVersion.textContent = data.model_version || "-";
  }

  if (modelTechnology) {
    modelTechnology.textContent =
      data.model_short_name || data.model_name || "Model Deteksi Hoaks";
  }

  datasetInfo.textContent = `${formatNumber(data.dataset_total || 0)} data`;

  if (processTime) {
    processTime.textContent = formatProcessTime(avgTime);
  }
}

function renderWeeklyTrend(trendData) {
  if (!chartBars || !chartYAxis) {
    return;
  }

  if (!Array.isArray(trendData) || trendData.length === 0) {
    chartYAxis.innerHTML = `
      <span>5</span>
      <span>4</span>
      <span>3</span>
      <span>2</span>
      <span>0</span>
    `;

    chartBars.innerHTML = `
      <div class="bar-item">
        <div class="bar-pair">
          <div class="bar-empty"></div>
          <div class="bar-empty"></div>
        </div>
        <span>-</span>
      </div>
    `;
    return;
  }

  const maxSingleValue = Math.max(
    ...trendData.map((item) =>
      Math.max(Number(item.fakta || 0), Number(item.hoaks || 0)),
    ),
    1,
  );

  const roundedMax = Math.max(5, Math.ceil(maxSingleValue / 5) * 5);

  const yAxisValues = [
    roundedMax,
    Math.round(roundedMax * 0.75),
    Math.round(roundedMax * 0.5),
    Math.round(roundedMax * 0.25),
    0,
  ];

  chartYAxis.innerHTML = yAxisValues
    .map((value) => `<span>${value}</span>`)
    .join("");

  chartBars.innerHTML = trendData
    .map((item) => {
      const total = Number(item.total || 0);
      const hoaks = Number(item.hoaks || 0);
      const fakta = Number(item.fakta || 0);

      const faktaPercentage = Math.max(
        (fakta / roundedMax) * 100,
        fakta > 0 ? 5 : 0,
      );

      const hoaksPercentage = Math.max(
        (hoaks / roundedMax) * 100,
        hoaks > 0 ? 5 : 0,
      );

      const faktaBar =
        fakta > 0
          ? `<div class="bar bar-fakta" style="height: ${faktaPercentage}%"></div>`
          : `<div class="bar-empty"></div>`;

      const hoaksBar =
        hoaks > 0
          ? `<div class="bar bar-hoaks" style="height: ${hoaksPercentage}%"></div>`
          : `<div class="bar-empty"></div>`;

      return `
        <div
          class="bar-item"
          title="Fakta: ${fakta}, Hoaks: ${hoaks}, Total: ${total}"
        >
          <div class="bar-pair">
            ${faktaBar}
            ${hoaksBar}
          </div>
          <span>${escapeHtml(item.day || "-")}</span>
        </div>
      `;
    })
    .join("");
}

function renderLatestAnalysis(items) {
  if (!latestAnalysisList) {
    return;
  }

  if (!Array.isArray(items) || items.length === 0) {
    latestAnalysisData = [];

    latestAnalysisList.innerHTML = `
      <div class="dashboard-latest-item">
        <div>
          <h4>Belum ada data analisis</h4>
          <p>Lakukan analisis berita terlebih dahulu agar data muncul di dashboard.</p>
        </div>
        <span class="dashboard-badge fakta">INFO</span>
      </div>
    `;
    return;
  }

  latestAnalysisData = items;

  latestAnalysisList.innerHTML = items
    .map((item, index) => {
      const label = item.prediction_label || "Fakta";
      const labelClass = getLabelClass(label);

      const title = item.title || "Tanpa judul";
      const source = item.source || "Sumber tidak diisi";
      const createdAt = item.created_at || "-";

      return `
        <div class="dashboard-latest-item" data-index="${index}" role="button" tabindex="0">
          <div>
            <h4>${escapeHtml(title)}</h4>
            <p>${escapeHtml(source)} • ${escapeHtml(createdAt)}</p>
          </div>

          <span class="dashboard-badge ${labelClass}">
            ${escapeHtml(label.toUpperCase())}
          </span>
        </div>
      `;
    })
    .join("");

  latestAnalysisList
    .querySelectorAll(".dashboard-latest-item[data-index]")
    .forEach((element) => {
      element.addEventListener("click", () => {
        const index = Number(element.dataset.index);
        openAnalysisDetail(latestAnalysisData[index]);
      });

      element.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          const index = Number(element.dataset.index);
          openAnalysisDetail(latestAnalysisData[index]);
        }
      });
    });
}

function renderDashboardError() {
  latestAnalysisList.innerHTML = `
    <div class="dashboard-latest-item">
      <div>
        <h4>Gagal memuat data dashboard</h4>
        <p>Pastikan backend berjalan dan endpoint /api/dashboard tidak error.</p>
      </div>
      <span class="dashboard-badge hoaks">ERROR</span>
    </div>
  `;
}

injectDashboardEnhancementStyle();
ensureDetailModal();
loadDashboard();

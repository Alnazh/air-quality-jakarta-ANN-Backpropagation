/**
 * dataset.js — Halaman Dataset
 */
'use strict';

let mainChart  = null;
let sortCol    = 'tanggal';
let sortDir    = 'asc';
let currentPg  = 1;

document.addEventListener('DOMContentLoaded', async () => {
  await loadChartData('all', 365);
  await loadCategoryDist();
  await loadCorrelation();
  await loadTableData(1);
  await loadPollutantInterpretation();
  initFilters();
  initSortControls();
});

// ── Chart ──────────────────────────────────────────────────────────────
async function loadChartData(station = 'all', limit = 365) {
  const res = await GreenSense.fetchAPI(
    `/api/chart-data?station=${encodeURIComponent(station)}&limit=${limit}`
  );
  if (!res.success) return;
  const d   = res.data;
  const def = GreenSense.chartDefaults();
  const el  = document.getElementById('chartPollutants');
  if (mainChart) { mainChart.destroy(); mainChart = null; }

  mainChart = new ApexCharts(el, {
    ...def,
    chart  : { ...def.chart, type: 'line', height: 320 },
    series : [
      { name: 'ISPU Maks', data: d.ispu  },
      { name: 'PM10',      data: d.pm10  },
      { name: 'PM25',      data: d.pm25  },
      { name: 'O3',        data: d.o3    },
      { name: 'NO2',       data: d.no2   },
    ],
    xaxis  : {
      categories: d.dates,
      tickAmount: 12,
      labels: {
        rotate: -30, hideOverlappingLabels: true,
        formatter: v => v ? v.slice(0, 7) : '',
        style: { fontSize: '10px' }
      }
    },
    yaxis  : { title: { text: 'Konsentrasi / Nilai ISPU' } },
    colors : ['#1fa97a', '#2563eb', '#7c3aed', '#f59e0b', '#ea580c'],
    legend : { position: 'top' },
    stroke : { width: [3, 1.5, 1.5, 1.5, 1.5] },
    dataLabels: { enabled: false },
    tooltip: { ...def.tooltip,
      y: { formatter: v => `${Number(v).toFixed(1)} µg/m³` }
    },
  });
  mainChart.render();
}

// ── Category donut ─────────────────────────────────────────────────────
async function loadCategoryDist() {
  const res = await GreenSense.fetchAPI('/api/category-dist');
  if (!res.success) return;
  const d      = res.data;
  const labels = Object.keys(d);
  const vals   = Object.values(d);
  const total  = vals.reduce((a, b) => a + b, 0);
  const colors = labels.map(l => GreenSense.getCatMeta(l).color);
  const def    = GreenSense.chartDefaults();

  new ApexCharts(document.getElementById('chartCatDonut'), {
    ...def,
    chart  : { ...def.chart, type: 'donut', height: 280 },
    series : vals, labels, colors,
    legend : { position: 'bottom', fontSize: '12px' },
    plotOptions: { pie: { donut: { size: '65%',
      labels: { show: true,
        total: { show: true, label: 'Total Record',
          formatter: () => total.toLocaleString() }
      }
    }}},
    tooltip: { y: { formatter: (v) => `${v.toLocaleString()} hari (${(v/total*100).toFixed(1)}%)` }},
  }).render();
}

// ── Correlation heatmap ────────────────────────────────────────────────
async function loadCorrelation() {
  const res = await GreenSense.fetchAPI('/api/correlation');
  if (!res.success) return;
  const { labels, matrix } = res.data;
  const container = document.getElementById('correlationTable');
  if (!container) return;

  const colorScale = v => {
    const abs = Math.abs(v);
    if (abs >= 0.7) return { bg: v > 0 ? '#15803d' : '#b91c1c', fg: '#ffffff' };
    if (abs >= 0.5) return { bg: v > 0 ? '#4ade80' : '#f87171', fg: '#1a1a1a' };
    if (abs >= 0.3) return { bg: v > 0 ? '#bbf7d0' : '#fecaca', fg: '#1a1a1a' };
    return { bg: '#f1f5f9', fg: '#475569' };
  };

  let html = '<table class="table table-bordered table-sm text-center mb-2" style="font-size:.8rem">';
  html    += '<thead class="table-light"><tr><th></th>' + labels.map(l => `<th>${l}</th>`).join('') + '</tr></thead><tbody>';
  matrix.forEach((row, i) => {
    html += `<tr><th class="table-light" style="font-size:.8rem">${labels[i]}</th>`;
    row.forEach(v => {
      const { bg, fg } = colorScale(v);
      html += `<td style="background:${bg};color:${fg};font-weight:600;cursor:help"
        title="${labels[i]} vs ${labels[matrix.indexOf(row)]}: ${v.toFixed(2)}">${v.toFixed(2)}</td>`;
    });
    html += '</tr>';
  });
  html += '</tbody></table>';

  html += `<div class="corr-legend">
    <div class="corr-legend-item"><div class="corr-dot" style="background:#15803d"></div><span>Korelasi positif sangat kuat (≥0.7)</span></div>
    <div class="corr-legend-item"><div class="corr-dot" style="background:#4ade80"></div><span>Positif kuat (0.5–0.7)</span></div>
    <div class="corr-legend-item"><div class="corr-dot" style="background:#bbf7d0"></div><span>Positif sedang (0.3–0.5)</span></div>
    <div class="corr-legend-item"><div class="corr-dot" style="background:#f1f5f9"></div><span>Lemah (&lt;0.3)</span></div>
    <div class="corr-legend-item"><div class="corr-dot" style="background:#fecaca"></div><span>Negatif sedang</span></div>
    <div class="corr-legend-item"><div class="corr-dot" style="background:#b91c1c"></div><span>Negatif kuat</span></div>
  </div>`;
  container.innerHTML = html;
}

// ── Pollutant interpretation ────────────────────────────────────────────
async function loadPollutantInterpretation() {
  const res = await GreenSense.fetchAPI('/api/chart-data?station=all&limit=30');
  if (!res.success) return;
  const d   = res.data;
  const avg = k => d[k] && d[k].length ? d[k].reduce((a, b) => a + b, 0) / d[k].length : 0;

  const pollutants = [
    { key: 'pm10', name: 'PM10',  label: 'Partikel kasar' },
    { key: 'pm25', name: 'PM2.5', label: 'Partikel halus' },
    { key: 'so2',  name: 'SO₂',   label: 'Sulfur dioksida' },
    { key: 'co',   name: 'CO',    label: 'Karbon monoksida' },
    { key: 'o3',   name: 'O₃',    label: 'Ozon' },
    { key: 'no2',  name: 'NO₂',   label: 'Nitrogen dioksida' },
  ];

  const el = document.getElementById('pollutantInterpret');
  if (!el) return;

  const html = pollutants.map(p => {
    const val    = avg(p.key);
    const interp = GreenSense.interpretPollutant(p.name, val);
    return `<div class="col-xl-2 col-md-4 col-6">
      <div class="p-2 rounded-3 text-center h-100" style="background:${interp.color}12;border:1px solid ${interp.color}30">
        <div class="fw-700" style="color:${interp.color};font-size:1rem">${val.toFixed(1)}</div>
        <div class="fw-600" style="font-size:.8rem">${p.name}</div>
        <div class="text-muted" style="font-size:.72rem">${p.label}</div>
        <span class="badge mt-1" style="background:${interp.color}20;color:${interp.color};font-size:.7rem">${interp.label}</span>
      </div>
    </div>`;
  }).join('');

  el.innerHTML = `<div class="row g-2">${html}</div>`;
}

// ── Data table with sort ────────────────────────────────────────────────
async function loadTableData(page = 1) {
  const station  = document.getElementById('filterStation')?.value || 'all';
  const year     = document.getElementById('filterYear')?.value    || 0;
  const category = document.getElementById('filterCategory')?.value || 'all';
  const perPage  = 20;
  currentPg      = page;

  const url = `/api/table?page=${page}&per_page=${perPage}`
    + `&station=${encodeURIComponent(station)}&year=${year}`
    + `&category=${encodeURIComponent(category)}`
    + `&sort_col=${sortCol}&sort_dir=${sortDir}`;

  const res = await GreenSense.fetchAPI(url);
  if (!res.success) return;

  const { records, total, total_pages, page: curPage } = res.data;

  const tbody = document.getElementById('tableBody');
  if (!tbody) return;

  const catBadge = cat => `<span class="badge-ispu badge-${GreenSense.getCatMeta(cat).css}">${cat}</span>`;

  tbody.innerHTML = records.length
    ? records.map(r => `
      <tr>
        <td>${r.tanggal}</td>
        <td style="font-size:.8rem">${r.stasiun}</td>
        <td>${r.pm10}</td><td>${r.pm25}</td>
        <td>${r.so2}</td><td>${r.co}</td>
        <td>${r.o3}</td><td>${r.no2}</td>
        <td><strong>${r.max}</strong></td>
        <td><span class="badge bg-secondary-subtle text-secondary" style="font-size:.72rem">${r.critical}</span></td>
        <td>${catBadge(r.categori)}</td>
      </tr>`).join('')
    : '<tr><td colspan="11" class="text-center py-4 text-muted">Tidak ada data ditemukan</td></tr>';

  const pgInfo  = document.getElementById('pageInfo');
  const pgInfo2 = document.getElementById('pageInfo2');
  const txt = `Halaman ${curPage} dari ${total_pages} · ${total.toLocaleString()} data`;
  if (pgInfo)  pgInfo.textContent  = txt;
  if (pgInfo2) pgInfo2.textContent = txt;

  const prev = document.getElementById('btnPrev');
  const next = document.getElementById('btnNext');
  if (prev) { prev.disabled = curPage <= 1;           prev.onclick = () => loadTableData(curPage - 1); }
  if (next) { next.disabled = curPage >= total_pages;  next.onclick = () => loadTableData(curPage + 1); }

  // Update sort column header highlights
  document.querySelectorAll('.gs-th-sort').forEach(th => {
    th.classList.remove('active');
    const icon = th.querySelector('i');
    if (icon) icon.className = 'ti ti-selector ms-1';
    if (th.dataset.col === sortCol) {
      th.classList.add('active');
      if (icon) icon.className = `ti ms-1 ${sortDir === 'asc' ? 'ti-sort-ascending' : 'ti-sort-descending'}`;
    }
  });
}

// ── Sort controls ──────────────────────────────────────────────────────
function initSortControls() {
  // Dropdown sort
  const sortColEl = document.getElementById('sortCol');
  sortColEl?.addEventListener('change', () => {
    sortCol = sortColEl.value;
    loadTableData(1);
  });

  // Direction toggle button
  const btnDir  = document.getElementById('btnSortDir');
  const dirIcon = document.getElementById('sortDirIcon');
  const dirLbl  = document.getElementById('sortDirLabel');
  btnDir?.addEventListener('click', () => {
    sortDir = sortDir === 'asc' ? 'desc' : 'asc';
    if (dirIcon) dirIcon.className = `ti ${sortDir === 'asc' ? 'ti-sort-ascending' : 'ti-sort-descending'}`;
    if (dirLbl)  dirLbl.textContent = sortDir.toUpperCase();
    loadTableData(1);
  });

  // Click on th headers
  document.querySelectorAll('.gs-th-sort').forEach(th => {
    th.addEventListener('click', () => {
      const col = th.dataset.col;
      if (sortCol === col) {
        sortDir = sortDir === 'asc' ? 'desc' : 'asc';
      } else {
        sortCol = col;
        sortDir = 'desc'; // default desc for numeric cols
      }
      // Sync dropdown
      if (sortColEl) sortColEl.value = sortCol;
      if (dirIcon)   dirIcon.className = `ti ${sortDir === 'asc' ? 'ti-sort-ascending' : 'ti-sort-descending'}`;
      if (dirLbl)    dirLbl.textContent = sortDir.toUpperCase();
      loadTableData(1);
    });
  });
}

// ── Filter listeners ───────────────────────────────────────────────────
function initFilters() {
  const stationSel = document.getElementById('filterStation');
  const limitSel   = document.getElementById('limitSelect');

  stationSel?.addEventListener('change', async () => {
    await loadChartData(stationSel.value, limitSel ? +limitSel.value : 365);
    await loadTableData(1);
  });

  limitSel?.addEventListener('change', async () => {
    await loadChartData(stationSel ? stationSel.value : 'all', +limitSel.value);
  });

  document.getElementById('filterYear')?.addEventListener('change',     () => loadTableData(1));
  document.getElementById('filterCategory')?.addEventListener('change', () => loadTableData(1));
}

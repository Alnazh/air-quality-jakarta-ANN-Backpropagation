/**
 * evaluasi.js — Halaman Evaluasi Model
 */
'use strict';

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btnLoadEval')?.addEventListener('click', loadEvaluation);
});

async function loadEvaluation() {
  const station = document.getElementById('evalStation').value;
  const mode    = document.getElementById('evalMode').value;

  GreenSense.showLoader('Memuat data evaluasi…');
  const res = await GreenSense.fetchAPI(
    `/api/evaluasi?station=${encodeURIComponent(station)}&mode=${mode}`
  );
  GreenSense.hideLoader();

  if (!res.success) {
    GreenSense.toast(
      'Model belum dilatih. Latih terlebih dahulu di halaman Prediksi ISPU.', 'warning', 5000
    );
    return;
  }

  const data = res.data;

  // Show result, hide placeholder
  document.getElementById('evalPlaceholder').style.display  = 'none';
  document.getElementById('evalResultSection').classList.remove('d-none');

  // Clear old charts
  ['evalChartLoss','evalChartSample','evalConfusion','evalChartAccuracy']
    .forEach(id => { const el = document.getElementById(id); if (el) el.innerHTML = ''; });

  // Show/hide regression vs classification sections (use classList, NOT style.display — d-none uses !important)
  const regSec = document.getElementById('evalRegressionSection');
  const clsSec = document.getElementById('evalClassSection');
  if (regSec) {
    if (data.mode === 'regression') regSec.classList.remove('d-none');
    else regSec.classList.add('d-none');
  }
  if (clsSec) {
    if (data.mode === 'classification') clsSec.classList.remove('d-none');
    else clsSec.classList.add('d-none');
  }

  renderEvalMetrics(data);
  renderLossChart(data);

  if (data.mode === 'regression' && data.sample_pred) {
    renderSampleChart(data);
  }
  if (data.mode === 'classification') {
    if (data.history?.accuracy?.length) renderAccuracyChart(data);
    // Render confusion matrix — pastikan section sudah visible dulu
    if (data.confusion_matrix && data.class_labels) {
      // Gunakan requestAnimationFrame agar DOM sudah dirender sebelum kita isi
      requestAnimationFrame(() => renderConfusionMatrix(data));
    }
  }

  GreenSense.toast('Evaluasi berhasil dimuat!', 'success');
}

// ── Metrics ────────────────────────────────────────────────────────────
function renderEvalMetrics(data) {
  const box  = document.getElementById('evalMetricsBox');
  const mode = data.mode;
  let html   = '';

  if (mode === 'regression') {
    const m      = data.metrics;
    const interp = GreenSense.interpretR2(m.r2);
    const pills  = [
      { val: m.mse.toFixed(4),  lbl: 'MSE',      sub: 'Kuadrat error rata-rata' },
      { val: m.rmse.toFixed(4), lbl: 'RMSE',     sub: `Meleset ±${m.rmse.toFixed(1)} poin ISPU` },
      { val: m.mae.toFixed(4),  lbl: 'MAE',      sub: 'Selisih absolut rata-rata' },
      { val: m.r2.toFixed(4),   lbl: 'R² Score', sub: interp.label },
    ];
    html = `<div class="row g-2 mb-3">
      ${pills.map(p => `
        <div class="col-6 col-md-3">
          <div class="gs-metric-pill">
            <div class="val">${p.val}</div>
            <div class="lbl">${p.lbl}</div>
            <div style="font-size:.7rem;color:#94a3b8;margin-top:2px">${p.sub}</div>
          </div>
        </div>`).join('')}
    </div>
    <div class="p-3 rounded-3 d-flex align-items-start gap-2"
         style="background:${interp.color}10;border:1px solid ${interp.color}30">
      <i class="ti ti-chart-line flex-shrink-0 mt-1" style="color:${interp.color}"></i>
      <div>
        <span class="fw-600" style="color:${interp.color}">${interp.label}</span>
        <span class="text-muted ms-2" style="font-size:.83rem">${interp.desc}</span>
      </div>
    </div>`;
  } else {
    const acc    = data.metrics.accuracy;
    const interp = GreenSense.interpretAccuracy(acc);
    html = `<div class="text-center mb-3">
      <div class="gs-metric-pill d-inline-block px-5">
        <div class="val">${(acc*100).toFixed(2)}%</div>
        <div class="lbl">Accuracy Klasifikasi</div>
        <div style="font-size:.7rem;color:#94a3b8;margin-top:2px">${interp.label}</div>
      </div>
    </div>
    <div class="p-3 rounded-3 d-flex align-items-start gap-2"
         style="background:${interp.color}10;border:1px solid ${interp.color}30">
      <i class="ti ti-circle-check flex-shrink-0 mt-1" style="color:${interp.color}"></i>
      <div>
        <span class="fw-600" style="color:${interp.color}">${interp.label}</span>
        <span class="text-muted ms-2" style="font-size:.83rem">${interp.desc}</span>
      </div>
    </div>`;
  }

  html += `<div class="p-2 rounded-3 mt-3"
    style="background:#f8fafc;border:1px solid #e2e8f0;font-size:.8rem">
    <i class="ti ti-info-circle me-1 text-muted"></i>
    Stasiun: <strong>${data.station}</strong> &nbsp;·&nbsp;
    Mode: <strong>${data.mode}</strong> &nbsp;·&nbsp;
    Epoch: <strong>${data.epochs_run}</strong> &nbsp;·&nbsp;
    Waktu: <strong>${data.train_seconds}s</strong> &nbsp;·&nbsp;
    Sampel: <strong>${(data.train_samples||0).toLocaleString()}</strong>
  </div>`;

  box.innerHTML = html;
}

// ── Loss chart ─────────────────────────────────────────────────────────
function renderLossChart(data) {
  const el = document.getElementById('evalChartLoss');
  if (!el || !data.history) return;
  const n   = data.history.loss.length;
  const def = GreenSense.chartDefaults();

  new ApexCharts(el, {
    ...def,
    chart  : { ...def.chart, type: 'line', height: 250 },
    series : [
      { name: 'Train Loss', data: data.history.loss.map(v => +v.toFixed(6)) },
      { name: 'Val Loss',   data: data.history.val_loss.map(v => +v.toFixed(6)) },
    ],
    colors : ['#1fa97a', '#f59e0b'],
    xaxis  : {
      categories: data.history.loss.map((_, i) => i + 1),
      tickAmount: Math.min(20, n),
      labels: { hideOverlappingLabels: true,
        formatter: v => Number.isInteger(+v) && +v > 0 ? +v : '',
        style: { fontSize: '10px' }
      },
      title: { text: 'Epoch' }
    },
    yaxis  : { title: { text: 'Loss' }, labels: { formatter: v => v.toFixed(4) } },
    stroke : { width: [2, 2], dashArray: [0, 5] },
    legend : { position: 'top' },
    dataLabels: { enabled: false },
    annotations: { xaxis: [{ x: data.epochs_run, borderColor: '#dc2626',
      label: { text: `Stop Ep.${data.epochs_run}`,
        style: { color: '#fff', background: '#dc2626', fontSize: '11px' } }
    }]},
  }).render();
}

// ── Actual vs Pred (regression) ────────────────────────────────────────
function renderSampleChart(data) {
  const el = document.getElementById('evalChartSample');
  if (!el || !data.sample_pred) return;
  const ns  = data.sample_pred.true.length;
  const def = GreenSense.chartDefaults();

  new ApexCharts(el, {
    ...def,
    chart  : { ...def.chart, type: 'line', height: 250 },
    series : [
      { name: 'Aktual',   data: data.sample_pred.true },
      { name: 'Prediksi', data: data.sample_pred.pred },
    ],
    colors : ['#2563eb', '#dc2626'],
    xaxis  : {
      categories: data.sample_pred.true.map((_, i) => i + 1),
      tickAmount: Math.min(15, ns),
      labels: { hideOverlappingLabels: true,
        formatter: v => Number.isInteger(+v) && +v > 0 ? +v : '',
        style: { fontSize: '10px' }
      },
      title: { text: 'Sampel Uji' }
    },
    yaxis  : { title: { text: 'Nilai ISPU' } },
    legend : { position: 'top' },
    stroke : { width: [2, 2], dashArray: [0, 5] },
    dataLabels: { enabled: false },
  }).render();
}

// ── Accuracy chart (classification) ────────────────────────────────────
function renderAccuracyChart(data) {
  const el = document.getElementById('evalChartAccuracy');
  if (!el || !data.history?.accuracy) return;
  const na  = data.history.accuracy.length;
  const def = GreenSense.chartDefaults();

  new ApexCharts(el, {
    ...def,
    chart  : { ...def.chart, type: 'line', height: 250 },
    series : [
      { name: 'Train Accuracy', data: data.history.accuracy.map(v => +(v*100).toFixed(2)) },
      { name: 'Val Accuracy',   data: data.history.val_accuracy.map(v => +(v*100).toFixed(2)) },
    ],
    colors : ['#2563eb', '#7c3aed'],
    xaxis  : {
      categories: data.history.accuracy.map((_, i) => i + 1),
      tickAmount: Math.min(20, na),
      labels: { hideOverlappingLabels: true,
        formatter: v => Number.isInteger(+v) && +v > 0 ? +v : '',
        style: { fontSize: '10px' }
      },
      title: { text: 'Epoch' }
    },
    yaxis  : { title: { text: 'Accuracy (%)' }, max: 100, min: 0 },
    legend : { position: 'top' },
    dataLabels: { enabled: false },
  }).render();
}

// ── Confusion matrix ────────────────────────────────────────────────────
function renderConfusionMatrix(data) {
  const el = document.getElementById('evalConfusion');
  if (!el) return;

  // Guard: pastikan data ada dan valid
  const matrix = data.confusion_matrix;
  const labels = data.class_labels;
  if (!matrix || !labels || !Array.isArray(matrix) || matrix.length === 0) {
    el.innerHTML = '<div class="text-center text-muted py-3" style="font-size:.85rem">'
      + '<i class="ti ti-alert-circle me-1"></i>Data confusion matrix tidak tersedia.</div>';
    return;
  }
  const maxVal = Math.max(...matrix.flat().filter(v => v > 0)) || 1;

  // Short labels for narrow display
  const shortLabel = l => {
    const map = {
      'BAIK': 'BAIK', 'SEDANG': 'SEDANG',
      'TIDAK SEHAT': 'TDK SEHAT',
      'SANGAT TIDAK SEHAT': 'SANGAT TDK',
      'BERBAHAYA': 'BERBAHAYA'
    };
    return map[l] || l;
  };

  // Summary stats
  const total    = matrix.flat().reduce((a, b) => a + b, 0);
  const correct  = matrix.reduce((s, row, i) => s + row[i], 0);
  const accuracy = total > 0 ? (correct / total * 100).toFixed(1) : 0;

  let html = `
    <!-- Summary row -->
    <div class="row g-2 mb-3">
      <div class="col-4">
        <div class="p-2 rounded-3 text-center" style="background:#e8f7f1;border:1px solid #9fe1cb">
          <div style="font-size:1.3rem;font-weight:700;color:#1fa97a">${accuracy}%</div>
          <div style="font-size:.72rem;color:#475569">Akurasi Keseluruhan</div>
        </div>
      </div>
      <div class="col-4">
        <div class="p-2 rounded-3 text-center" style="background:#eff6ff;border:1px solid #bfdbfe">
          <div style="font-size:1.3rem;font-weight:700;color:#2563eb">${correct.toLocaleString()}</div>
          <div style="font-size:.72rem;color:#475569">Prediksi Benar</div>
        </div>
      </div>
      <div class="col-4">
        <div class="p-2 rounded-3 text-center" style="background:#fee2e2;border:1px solid #fca5a5">
          <div style="font-size:1.3rem;font-weight:700;color:#dc2626">${(total - correct).toLocaleString()}</div>
          <div style="font-size:.72rem;color:#475569">Prediksi Salah</div>
        </div>
      </div>
    </div>

    <!-- Matrix table -->
    <div class="table-responsive">
    <table class="table table-bordered mb-0"
           style="font-size:.78rem;border-collapse:separate;border-spacing:2px">
      <thead>
        <tr>
          <th class="text-muted" style="background:#f8fafc;border:none;font-size:.7rem;
              vertical-align:bottom;padding:6px 4px">
            Aktual ↓ / Pred →
          </th>`;

  labels.forEach(l => {
    html += `<th class="text-center" style="background:#f1f5f9;border:1px solid #e2e8f0;
      padding:6px 4px;font-size:.72rem;white-space:nowrap">${shortLabel(l)}</th>`;
  });
  html += `<th style="background:#f1f5f9;border:1px solid #e2e8f0;padding:6px 4px;
    font-size:.72rem;text-align:center">Total</th></tr></thead><tbody>`;

  matrix.forEach((row, i) => {
    const rowTotal = row.reduce((a, b) => a + b, 0);
    html += `<tr>
      <th style="background:#f1f5f9;border:1px solid #e2e8f0;padding:6px 8px;
          font-size:.72rem;white-space:nowrap">${shortLabel(labels[i])}</th>`;

    row.forEach((v, j) => {
      const isDiag    = i === j;
      const intensity = v > 0 ? v / maxVal : 0;
      let bg, fg, title;

      if (isDiag) {
        // Correct prediction — green gradient
        const alpha = 0.15 + intensity * 0.75;
        bg    = `rgba(31,169,122,${alpha.toFixed(2)})`;
        fg    = intensity > 0.5 ? '#fff' : '#166f52';
        title = `Benar: ${v} sampel ${labels[i]} diprediksi tepat`;
      } else if (v > 0) {
        // Wrong prediction — red gradient
        const alpha = 0.1 + intensity * 0.6;
        bg    = `rgba(220,38,38,${alpha.toFixed(2)})`;
        fg    = intensity > 0.4 ? '#fff' : '#991b1b';
        title = `Salah: ${v} sampel ${labels[i]} diprediksi sebagai ${labels[j]}`;
      } else {
        bg    = '#f8fafc';
        fg    = '#cbd5e1';
        title = 'Tidak ada kasus';
      }

      const pct = rowTotal > 0 ? (v / rowTotal * 100).toFixed(0) : 0;
      html += `<td class="text-center" title="${title}"
        style="background:${bg};color:${fg};font-weight:${v>0?'600':'400'};
               padding:8px 4px;border-radius:6px;border:none;min-width:52px">
        ${v > 0 ? `<div style="font-size:.85rem">${v}</div>
                   <div style="font-size:.65rem;opacity:.8">${pct}%</div>` : '—'}
      </td>`;
    });

    html += `<td class="text-center"
      style="background:#f8fafc;color:#475569;font-weight:500;
             padding:8px 4px;border:1px solid #e2e8f0;font-size:.78rem">
      ${rowTotal.toLocaleString()}
    </td></tr>`;
  });

  // Column totals row
  html += `<tr><td style="background:#f1f5f9;border:1px solid #e2e8f0;padding:6px 8px;
    font-size:.7rem;font-weight:600;color:#475569">Total</td>`;
  labels.forEach((_, j) => {
    const colTotal = matrix.reduce((s, row) => s + row[j], 0);
    html += `<td class="text-center"
      style="background:#f1f5f9;color:#475569;font-weight:500;
             padding:6px 4px;border:1px solid #e2e8f0;font-size:.78rem">
      ${colTotal.toLocaleString()}
    </td>`;
  });
  html += `<td class="text-center"
    style="background:#e8f7f1;color:#166f52;font-weight:700;
           padding:6px 4px;border:1px solid #9fe1cb;font-size:.82rem">
    ${total.toLocaleString()}
  </td></tr>`;

  html += '</tbody></table></div>';

  // Per-class accuracy
  html += `<div class="mt-3">
    <div class="fw-500 mb-2" style="font-size:.8rem;color:#475569">
      <i class="ti ti-chart-bar me-1 text-success"></i>Akurasi per Kategori:
    </div>
    <div class="row g-1">`;

  labels.forEach((l, i) => {
    const rowTotal = matrix[i].reduce((a, b) => a + b, 0);
    const correct  = matrix[i][i];
    const acc      = rowTotal > 0 ? (correct / rowTotal * 100).toFixed(1) : 0;
    const meta     = GreenSense.getCatMeta(l);
    const pct      = parseFloat(acc);
    html += `<div class="col">
      <div class="p-2 rounded-3 text-center" style="background:${meta.bg};border:1px solid ${meta.color}30">
        <div style="font-size:.95rem;font-weight:700;color:${meta.color}">${acc}%</div>
        <div class="badge-ispu badge-${meta.css}" style="font-size:.65rem;margin-top:2px">
          ${shortLabel(l)}
        </div>
        <div style="font-size:.68rem;color:#64748b;margin-top:2px">${correct}/${rowTotal}</div>
      </div>
    </div>`;
  });

  html += `</div></div>`;
  el.innerHTML = html;
}

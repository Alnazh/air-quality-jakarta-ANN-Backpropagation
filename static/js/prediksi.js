/**
 * prediksi.js — Halaman Prediksi ISPU
 */
'use strict';

let lossChart     = null;
let accuracyChart = null;
let sampleChart   = null;

document.addEventListener('DOMContentLoaded', () => {
  initTrainForm();
  initPredictForm();
  initModeToggle();
});

function initModeToggle() {
  document.querySelectorAll('input[name="mode"]').forEach(radio => {
    radio.addEventListener('change', () => {
      const mode = document.querySelector('input[name="mode"]:checked').value;
      document.getElementById('regressionNote').style.display =
        mode === 'regression' ? 'block' : 'none';
      document.getElementById('classificationNote').style.display =
        mode === 'classification' ? 'block' : 'none';
    });
  });
}

// ── TRAIN ─────────────────────────────────────────────────────────────
function initTrainForm() {
  const btn = document.getElementById('btnTrain');
  if (!btn) return;

  btn.addEventListener('click', async () => {
    const station  = document.getElementById('trainStation').value;
    const mode     = document.querySelector('input[name="mode"]:checked').value;
    const epochs   = +document.getElementById('epochs').value;
    const h1       = +document.getElementById('h1').value;
    const h2       = +document.getElementById('h2').value;
    const h3       = +document.getElementById('h3').value;
    const dropout  = +document.getElementById('dropout').value;
    const lr       = +document.getElementById('lr').value;
    const batch    = +document.getElementById('batchSize').value;
    const patience = +document.getElementById('patience').value;

    setTrainBtnState(true);
    clearLog();
    log(`🚀 Memulai pelatihan model (${mode}) — stasiun: ${station}`, 'info');
    log(`📐 Arsitektur: Input(9) → Dense(${h1}) → Dense(${h2}) → Dense(${h3}) → Output`, 'info');
    log(`⚙️  Epochs: ${epochs} | LR: ${lr} | Dropout: ${dropout} | Batch: ${batch} | Patience: ${patience}`, 'info');
    log('─────────────────────────────────────────────');

    // Show progress bar
    const progressWrap = document.getElementById('trainProgressWrap');
    const progressBar  = document.getElementById('trainProgressBar');
    const progressPct  = document.getElementById('trainProgressPct');
    if (progressWrap) progressWrap.classList.remove('d-none');

    // Animate progress bar (simulated — real progress comes from log)
    let pct = 0;
    const progressInterval = setInterval(() => {
      pct = Math.min(pct + Math.random() * 3, 90);
      if (progressBar) progressBar.style.width = pct + '%';
      if (progressPct) progressPct.textContent  = Math.round(pct) + '%';
    }, 400);

    GreenSense.showLoader('Melatih model ANN Backpropagation…');

    const res = await GreenSense.postJSON('/api/train', {
      station, mode, epochs, h1, h2, h3, dropout, lr,
      batch_size: batch, patience
    });

    GreenSense.hideLoader();
    setTrainBtnState(false);

    // Complete progress bar
    clearInterval(progressInterval);
    if (progressBar) progressBar.style.width = '100%';
    if (progressPct) progressPct.textContent  = '100%';
    setTimeout(() => { if (progressWrap) progressWrap.classList.add('d-none'); }, 1500);

    if (!res.success) {
      log(`❌ Error: ${res.error}`, 'warn');
      GreenSense.toast(res.error, 'danger');
      return;
    }

    const d = res.data;
    log(`✅ Selesai dalam ${d.train_seconds}s — ${d.epochs_run} epoch dijalankan`, 'success');

    if (mode === 'regression') {
      const m = d.metrics;
      log(`📊 MSE: ${m.mse.toFixed(4)} | RMSE: ${m.rmse.toFixed(4)} | MAE: ${m.mae.toFixed(4)} | R²: ${m.r2.toFixed(4)}`, 'success');
    } else {
      log(`📊 Accuracy: ${(d.metrics.accuracy * 100).toFixed(2)}%`, 'success');
    }

    // Show result, hide placeholder
    const placeholder = document.getElementById('trainPlaceholder');
    const resultSec   = document.getElementById('trainResultSection');
    if (placeholder) placeholder.style.display = 'none';
    if (resultSec)   resultSec.classList.remove('d-none');

    renderTrainMetrics(d);
    renderLossChart(d.history, d.epochs_run);

    if (mode === 'classification' && d.history.accuracy && d.history.accuracy.length) {
      renderAccuracyChart(d.history);
      const accSec = document.getElementById('accuracySection');
      const spSec  = document.getElementById('samplePredSection');
      const cmSec  = document.getElementById('cmSection');
      if (accSec) accSec.classList.remove('d-none');
      if (spSec)  spSec.classList.add('d-none');
      if (d.confusion_matrix && d.class_labels) {
        renderConfusionMatrixInline(d);
      }
    } else {
      const accSec = document.getElementById('accuracySection');
      const spSec  = document.getElementById('samplePredSection');
      const cmSec  = document.getElementById('cmSection');
      if (accSec) accSec.classList.add('d-none');
      if (spSec)  spSec.classList.remove('d-none');
      if (cmSec)  cmSec.classList.add('d-none');
    }

    if (mode === 'regression' && d.sample_pred) {
      renderSamplePred(d.sample_pred);
    }

    GreenSense.toast('Model berhasil dilatih!', 'success');
  });
}

// ── PREDICT ───────────────────────────────────────────────────────────
function initPredictForm() {
  const btn = document.getElementById('btnPredict');
  if (!btn) return;

  document.getElementById('predBulan')?.addEventListener('change', function () {
    const dry = [6, 7, 8, 9].includes(+this.value) ? 1 : 0;
    const el  = document.getElementById('predDrySeason');
    if (el) el.value = dry;
  });

  btn.addEventListener('click', async () => {
    const station       = document.getElementById('predStation').value;
    const mode          = document.querySelector('input[name="mode"]:checked').value;
    const pm10          = +document.getElementById('predPm10').value;
    const pm25          = +document.getElementById('predPm25').value;
    const so2           = +document.getElementById('predSo2').value;
    const co            = +document.getElementById('predCo').value;
    const o3            = +document.getElementById('predO3').value;
    const no2           = +document.getElementById('predNo2').value;
    const bulan         = +document.getElementById('predBulan').value;
    const day_of_week   = +document.getElementById('predDay').value;
    const is_dry_season = +document.getElementById('predDrySeason').value;

    GreenSense.showLoader('Menghitung prediksi…');
    const res = await GreenSense.postJSON('/api/predict', {
      station, mode, pm10, pm25, so2, co, o3, no2,
      bulan, day_of_week, is_dry_season
    });
    GreenSense.hideLoader();

    if (!res.success) {
      GreenSense.toast(res.error, 'danger');
      return;
    }

    renderPredResult(res.data);
    GreenSense.toast('Prediksi berhasil!', 'success');
  });
}

// ── Render helpers ─────────────────────────────────────────────────────
function renderPredResult(data) {
  const box = document.getElementById('predResultBox');
  box.classList.remove('d-none');
  const cat  = data.category;
  const meta = GreenSense.getCatMeta(cat);

  if (data.mode === 'regression') {
    const interp = GreenSense.interpretISPU(data.value);
    box.innerHTML = `
      <div class="gs-result-box" style="border-color:${meta.color};background:${meta.bg}">
        <div class="gs-result-value" style="color:${meta.color}">${data.value}</div>
        <div class="gs-result-label">Nilai ISPU Prediksi</div>
        <div class="mt-2">${GreenSense.badgeHtml(cat)}</div>
        <hr style="border-color:${meta.color}30;margin:.8rem 0">
        <div class="p-2 rounded-3 text-start" style="background:rgba(0,0,0,.04);font-size:.82rem">
          <i class="ti ${interp.icon} me-1" style="color:${interp.color}"></i>
          <strong style="color:${interp.color}">${interp.label}</strong><br>
          <span class="text-muted">${interp.advice}</span>
        </div>
        <div class="mt-2 text-muted" style="font-size:.75rem">Rentang ISPU: ${meta.range}</div>
      </div>`;
  } else {
    const probs = data.probabilities || {};
    const interp = GreenSense.interpretISPU(
      {'BAIK':25,'SEDANG':75,'TIDAK SEHAT':150,'SANGAT TIDAK SEHAT':250,'BERBAHAYA':350}[cat] || 75
    );
    const probBars = Object.entries(probs)
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => {
        const m2 = GreenSense.getCatMeta(k);
        return `<div class="gs-prob-row d-flex align-items-center gap-2">
          <span class="label">${k}</span>
          <div class="bar"><div class="fill" style="width:${v}%;background:${m2.color}"></div></div>
          <span class="pct">${v}%</span>
        </div>`;
      }).join('');
    box.innerHTML = `
      <div class="gs-result-box" style="border-color:${meta.color};background:${meta.bg}">
        <i class="ti ${meta.icon}" style="font-size:2.2rem;color:${meta.color}"></i>
        <div class="gs-result-value mt-2" style="color:${meta.color};font-size:1.8rem">${cat}</div>
        <div class="gs-result-label">Kategori ISPU Prediksi</div>
        <div class="mt-1 text-muted" style="font-size:.82rem">Confidence: <strong>${data.confidence}%</strong></div>
        <hr style="border-color:${meta.color}30;margin:.8rem 0">
        <div class="p-2 rounded-3 text-start mb-2" style="background:rgba(0,0,0,.04);font-size:.82rem">
          <i class="ti ti-info-circle me-1 text-muted"></i>
          <span class="text-muted">${interp.advice}</span>
        </div>
        <div class="text-start">${probBars}</div>
      </div>`;
  }
}

function renderLossChart(history, epochsRun) {
  const el = document.getElementById('chartLoss');
  if (!el) return;
  if (lossChart) { lossChart.destroy(); lossChart = null; }

  const n      = history.loss.length;
  // Create clean x-axis labels — show at most 20 ticks
  const step   = Math.max(1, Math.ceil(n / 20));
  const labels = history.loss.map((_, i) => (i % step === 0 || i === n - 1) ? String(i + 1) : '');

  const def = GreenSense.chartDefaults();
  lossChart = new ApexCharts(el, {
    ...def,
    chart  : { ...def.chart, type: 'line', height: 250 },
    series : [
      { name: 'Train Loss',      data: history.loss.map(v => +v.toFixed(6)) },
      { name: 'Validation Loss', data: history.val_loss.map(v => +v.toFixed(6)) },
    ],
    colors : ['#1fa97a', '#f59e0b'],
    xaxis  : {
      categories: history.loss.map((_, i) => i + 1),
      tickAmount: Math.min(20, n),
      labels: {
        hideOverlappingLabels: true,
        formatter: v => Number.isInteger(v) ? v : '',
        style: { fontSize: '10px' }
      },
      title: { text: 'Epoch' }
    },
    yaxis  : {
      title: { text: 'Loss' },
      labels: { formatter: v => v.toFixed(4) }
    },
    stroke : { width: [2, 2], dashArray: [0, 5] },
    legend : { position: 'top' },
    dataLabels: { enabled: false },
    annotations: {
      xaxis: [{
        x: epochsRun,
        borderColor: '#dc2626',
        label: { text: `Stop: Ep ${epochsRun}`, style: { color: '#fff', background: '#dc2626' } }
      }]
    },
  });
  lossChart.render();
}

function renderAccuracyChart(history) {
  const el = document.getElementById('chartAccuracy');
  if (!el) return;
  if (accuracyChart) { accuracyChart.destroy(); accuracyChart = null; }

  const n   = history.accuracy.length;
  const def = GreenSense.chartDefaults();
  accuracyChart = new ApexCharts(el, {
    ...def,
    chart  : { ...def.chart, type: 'line', height: 220 },
    series : [
      { name: 'Train Accuracy',      data: history.accuracy.map(v => +(v * 100).toFixed(2)) },
      { name: 'Validation Accuracy', data: history.val_accuracy.map(v => +(v * 100).toFixed(2)) },
    ],
    colors : ['#2563eb', '#7c3aed'],
    xaxis  : {
      categories: history.accuracy.map((_, i) => i + 1),
      tickAmount: Math.min(20, n),
      labels: {
        hideOverlappingLabels: true,
        formatter: v => Number.isInteger(v) ? v : '',
        style: { fontSize: '10px' }
      },
      title: { text: 'Epoch' }
    },
    yaxis  : { title: { text: 'Accuracy (%)' }, max: 100, min: 0 },
    legend : { position: 'top' },
    dataLabels: { enabled: false },
  });
  accuracyChart.render();
}

function renderSamplePred(sp) {
  const el = document.getElementById('chartSamplePred');
  if (!el) return;
  if (sampleChart) { sampleChart.destroy(); sampleChart = null; }

  const n   = sp.true.length;
  const def = GreenSense.chartDefaults();
  sampleChart = new ApexCharts(el, {
    ...def,
    chart  : { ...def.chart, type: 'line', height: 220 },
    series : [
      { name: 'Aktual',   data: sp.true },
      { name: 'Prediksi', data: sp.pred },
    ],
    colors : ['#1fa97a', '#f59e0b'],
    xaxis  : {
      categories: sp.true.map((_, i) => i + 1),
      tickAmount: Math.min(15, n),
      labels: { hideOverlappingLabels: true, style: { fontSize: '10px' } },
      title: { text: 'Sampel Uji' }
    },
    yaxis  : { title: { text: 'Nilai ISPU' } },
    legend : { position: 'top' },
    dataLabels: { enabled: false },
  });
  sampleChart.render();
}

// ── Log helpers ────────────────────────────────────────────────────────
function log(msg, type = '') {
  const el = document.getElementById('trainingLog');
  if (!el) return;
  const div = document.createElement('div');
  div.className = type ? `log-${type}` : '';
  div.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
  el.appendChild(div);
  el.scrollTop = el.scrollHeight;
}

function clearLog() {
  const el = document.getElementById('trainingLog');
  if (el) el.innerHTML = '';
}

function setTrainBtnState(loading) {
  const btn = document.getElementById('btnTrain');
  if (!btn) return;
  btn.disabled  = loading;
  btn.innerHTML = loading
    ? '<span class="spinner-border spinner-border-sm me-1"></span> Melatih…'
    : '<i class="ti ti-chart-dots me-1"></i> Mulai Latih Model';
}

// ── Metrics summary card after training ───────────────────────────────
function renderTrainMetrics(data) {
  const box  = document.getElementById('trainMetricsBox');
  const mode = data.mode;
  if (!box) return;

  let html = '<div class="row g-2 justify-content-center">';
  if (mode === 'regression') {
    const m = data.metrics;
    [['MSE', m.mse.toFixed(4)], ['RMSE', m.rmse.toFixed(4)],
     ['MAE', m.mae.toFixed(4)], ['R²', m.r2.toFixed(4)]].forEach(([lbl, val]) => {
      html += `<div class="col-6 col-md-3"><div class="gs-metric-pill">
        <div class="val">${val}</div><div class="lbl">${lbl}</div>
      </div></div>`;
    });
  } else {
    // Accuracy centered + 3 interpretation badges
    const acc     = (data.metrics.accuracy * 100).toFixed(2);
    const accNum  = parseFloat(acc);
    const quality = accNum >= 90 ? { label: 'Sangat Baik', color: '#16a34a', bg: '#dcfce7' }
                  : accNum >= 75 ? { label: 'Baik', color: '#ca8a04', bg: '#fef9c3' }
                  : { label: 'Perlu Ditingkatkan', color: '#ea580c', bg: '#ffedd5' };
    html += `
      <div class="col-12 text-center mb-1">
        <div class="gs-metric-pill d-inline-block px-5">
          <div class="val">${acc}%</div>
          <div class="lbl">Accuracy Klasifikasi</div>
        </div>
      </div>
      <div class="col-12 text-center">
        <span class="badge px-3 py-2" style="background:${quality.bg};color:${quality.color};font-size:.85rem">
          <i class="ti ti-circle-check me-1"></i>${quality.label}
        </span>
        <div class="text-muted mt-1" style="font-size:.78rem">
          ${accNum >= 90 ? 'Model mampu mengklasifikasikan kategori ISPU dengan sangat akurat.'
          : accNum >= 75 ? 'Model cukup baik. Coba naikkan epochs atau neurons untuk hasil lebih baik.'
          : 'Akurasi rendah. Coba naikkan H1/H2/H3, turunkan learning rate, atau tambah epochs.'}
        </div>
      </div>`;
  }
  html += `<div class="col-12 mt-1">
    <div class="p-2 rounded-3" style="background:#f8fafc;border:1px solid #e2e8f0;font-size:.79rem">
      <i class="ti ti-info-circle me-1 text-muted"></i>
      Epoch berjalan: <strong>${data.epochs_run}</strong> &nbsp;·&nbsp;
      Waktu: <strong>${data.train_seconds}s</strong> &nbsp;·&nbsp;
      Sampel: <strong>${(data.train_samples||0).toLocaleString()}</strong> &nbsp;·&nbsp;
      Mode: <strong>${data.mode}</strong>
    </div>
  </div>`;
  html += '</div>';
  box.innerHTML = html;
}

// ── Inline confusion matrix (compact, for prediksi page) ──────────────
function renderConfusionMatrixInline(data) {
  const cmSec = document.getElementById('cmSection');
  const el    = document.getElementById('trainConfusion');
  if (!el || !data.confusion_matrix) return;
  // Must remove d-none class, NOT use style.display (Bootstrap d-none uses !important)
  if (cmSec) cmSec.classList.remove('d-none');

  const matrix = data.confusion_matrix;
  const labels = data.class_labels;
  const maxVal = Math.max(...matrix.flat().filter(v => v > 0)) || 1;
  const total  = matrix.flat().reduce((a, b) => a + b, 0);
  const correct = matrix.reduce((s, row, i) => s + (row[i] || 0), 0);
  const acc     = total > 0 ? (correct / total * 100).toFixed(1) : 0;

  const shortLabel = l => ({
    'BAIK':'BAIK','SEDANG':'SEDANG','TIDAK SEHAT':'TDK SEHAT',
    'SANGAT TIDAK SEHAT':'SANGAT TDK','BERBAHAYA':'BERBAHAYA'
  }[l] || l);

  let html = `<div class="d-flex align-items-center gap-3 mb-3 flex-wrap">
    <div class="p-2 rounded-3 text-center" style="background:#e8f7f1;border:1px solid #9fe1cb;min-width:80px">
      <div style="font-size:1.1rem;font-weight:700;color:#1fa97a">${acc}%</div>
      <div style="font-size:.7rem;color:#475569">Akurasi</div>
    </div>
    <div class="p-2 rounded-3 text-center" style="background:#eff6ff;border:1px solid #bfdbfe;min-width:80px">
      <div style="font-size:1.1rem;font-weight:700;color:#2563eb">${correct.toLocaleString()}</div>
      <div style="font-size:.7rem;color:#475569">Benar</div>
    </div>
    <div class="p-2 rounded-3 text-center" style="background:#fee2e2;border:1px solid #fca5a5;min-width:80px">
      <div style="font-size:1.1rem;font-weight:700;color:#dc2626">${(total-correct).toLocaleString()}</div>
      <div style="font-size:.7rem;color:#475569">Salah</div>
    </div>
  </div>
  <div class="table-responsive">
  <table class="table table-bordered mb-0" style="font-size:.75rem;border-collapse:separate;border-spacing:2px">
    <thead><tr>
      <th style="background:#f8fafc;border:none;font-size:.68rem;color:#94a3b8;padding:4px">Aktual↓/Pred→</th>`;

  labels.forEach(l => {
    html += `<th class="text-center" style="background:#f1f5f9;border:1px solid #e2e8f0;padding:4px 3px;font-size:.68rem;white-space:nowrap">${shortLabel(l)}</th>`;
  });
  html += '</tr></thead><tbody>';

  matrix.forEach((row, i) => {
    html += `<tr><th style="background:#f1f5f9;border:1px solid #e2e8f0;padding:4px 6px;font-size:.68rem;white-space:nowrap">${shortLabel(labels[i])}</th>`;
    row.forEach((v, j) => {
      const isDiag = i === j;
      const alpha  = v > 0 ? (isDiag ? 0.2 + (v/maxVal)*0.7 : 0.1 + (v/maxVal)*0.5) : 0;
      const bg     = v === 0 ? '#f8fafc' : isDiag ? `rgba(31,169,122,${alpha})` : `rgba(220,38,38,${alpha})`;
      const fg     = alpha > 0.55 ? '#fff' : isDiag ? '#166f52' : '#991b1b';
      html += `<td class="text-center" style="background:${bg};color:${v>0?fg:'#cbd5e1'};font-weight:${v>0?'600':'400'};padding:5px 3px;border-radius:4px;border:none;min-width:44px">
        ${v > 0 ? v : '—'}</td>`;
    });
    html += '</tr>';
  });

  html += '</tbody></table></div>';
  el.innerHTML = html;
}

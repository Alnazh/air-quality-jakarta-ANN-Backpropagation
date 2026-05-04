/**
 * greensense.js — GreenSense Jakarta
 * ANN Backpropagation Air Quality Prediction
 */
'use strict';

const ISPU_CATEGORIES = {
  'BAIK'               : { color: '#16a34a', bg: '#dcfce7', css: 'baik',        icon: 'ti-leaf',           range: '0–50'   },
  'SEDANG'             : { color: '#ca8a04', bg: '#fef9c3', css: 'sedang',       icon: 'ti-sun',            range: '51–100' },
  'TIDAK SEHAT'        : { color: '#ea580c', bg: '#ffedd5', css: 'tidak-sehat',  icon: 'ti-alert-triangle', range: '101–199'},
  'SANGAT TIDAK SEHAT' : { color: '#dc2626', bg: '#fee2e2', css: 'sangat',       icon: 'ti-flame',          range: '200–299'},
  'BERBAHAYA'          : { color: '#7c3aed', bg: '#ede9fe', css: 'berbahaya',    icon: 'ti-biohazard',      range: '>300'   },
};

window.GreenSense = {

  getCatMeta(name) {
    return ISPU_CATEGORIES[name] || { color: '#6c757d', bg: '#f1f5f9', css: '', icon: 'ti-help', range: '-' };
  },

  badgeHtml(category) {
    const m = this.getCatMeta(category);
    return `<span class="badge-ispu badge-${m.css}">${category}</span>`;
  },

  showLoader(msg = 'Memproses…') {
    let el = document.getElementById('gsLoader');
    if (!el) {
      el = document.createElement('div');
      el.id = 'gsLoader';
      el.innerHTML = `<div class="spinner-border" role="status"></div><p>${msg}</p>`;
      document.body.appendChild(el);
    } else {
      el.querySelector('p').textContent = msg;
      el.style.display = 'flex';
    }
  },

  hideLoader() {
    const el = document.getElementById('gsLoader');
    if (el) el.style.display = 'none';
  },

  toast(msg, type = 'success', duration = 3500) {
    const container = document.getElementById('toast-container') || (() => {
      const c = document.createElement('div');
      c.id = 'toast-container';
      c.style.cssText = 'position:fixed;top:1rem;right:1rem;z-index:10000;display:flex;flex-direction:column;gap:.5rem;';
      document.body.appendChild(c);
      return c;
    })();
    const colors = { success: '#16a34a', danger: '#dc2626', warning: '#ca8a04', info: '#2563eb' };
    const icons  = { success: 'ti-check', danger: 'ti-x', warning: 'ti-alert-triangle', info: 'ti-info-circle' };
    const t = document.createElement('div');
    t.style.cssText = `background:#fff;border-left:4px solid ${colors[type]};border-radius:8px;
      padding:.7rem 1rem;box-shadow:0 4px 16px rgba(0,0,0,.12);
      display:flex;align-items:center;gap:.6rem;min-width:260px;max-width:340px;
      font-size:.85rem;font-weight:500;animation:slideIn .25s ease;`;
    t.innerHTML = `<i class="ti ${icons[type]}" style="color:${colors[type]};font-size:1.1rem"></i><span>${msg}</span>`;
    container.appendChild(t);
    setTimeout(() => t.remove(), duration);
  },

  async fetchAPI(url, opts = {}) {
    try {
      const res  = await fetch(url, opts);
      const json = await res.json();
      return json;
    } catch (e) {
      return { success: false, error: e.message };
    }
  },

  async postJSON(url, body) {
    return this.fetchAPI(url, {
      method : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body   : JSON.stringify(body),
    });
  },

  initRangeInputs() {
    document.querySelectorAll('input[type="range"][data-show]').forEach(el => {
      const target = document.getElementById(el.dataset.show);
      if (!target) return;
      target.textContent = el.value;
      el.addEventListener('input', () => { target.textContent = el.value; });
    });
  },

  // Always use light theme
  chartDefaults() {
    return {
      chart : { background: 'transparent', toolbar: { show: false } },
      theme : { mode: 'light' },
      stroke: { curve: 'smooth', width: 2 },
      grid  : { borderColor: '#e2e8f0' },
      tooltip: { theme: 'light' },
    };
  },
};

const style = document.createElement('style');
style.textContent = `@keyframes slideIn{from{opacity:0;transform:translateX(20px)}to{opacity:1;transform:none}}`;
document.head.appendChild(style);

document.addEventListener('DOMContentLoaded', () => GreenSense.initRangeInputs());

// ── Interpretasi helpers (for non-expert users) ───────────────────────
window.GreenSense.interpretISPU = function(val) {
  if (val <= 50)    return { label: 'Baik',               icon: 'ti-leaf',           color: '#16a34a', advice: 'Udara sangat bersih. Aman untuk semua aktivitas di luar ruangan.' };
  if (val <= 100)   return { label: 'Sedang',             icon: 'ti-sun',            color: '#ca8a04', advice: 'Udara cukup baik. Orang yang sangat sensitif (asma, jantung) sebaiknya kurangi aktivitas berat di luar.' };
  if (val <= 199)   return { label: 'Tidak Sehat',        icon: 'ti-alert-triangle', color: '#ea580c', advice: 'Semua orang mulai merasakan dampak. Kurangi aktivitas di luar ruangan, terutama anak-anak dan lansia.' };
  if (val <= 299)   return { label: 'Sangat Tidak Sehat', icon: 'ti-flame',          color: '#dc2626', advice: 'Berbahaya bagi semua orang. Hindari aktivitas di luar ruangan. Gunakan masker jika harus keluar.' };
  return             { label: 'Berbahaya',               icon: 'ti-biohazard',      color: '#7c3aed', advice: 'Darurat kesehatan! Seluruh populasi terdampak. Tetap di dalam ruangan dan tutup semua ventilasi.' };
};

window.GreenSense.interpretR2 = function(r2) {
  if (r2 >= 0.95) return { label: 'Sangat Akurat',     color: '#16a34a', desc: `Model menjelaskan ${(r2*100).toFixed(1)}% variasi data — prediksi sangat mendekati nilai asli.` };
  if (r2 >= 0.85) return { label: 'Akurat',            color: '#1fa97a', desc: `Model menjelaskan ${(r2*100).toFixed(1)}% variasi data — hasil prediksi dapat diandalkan.` };
  if (r2 >= 0.70) return { label: 'Cukup Baik',        color: '#ca8a04', desc: `Model menjelaskan ${(r2*100).toFixed(1)}% variasi data — bisa digunakan namun masih ada ruang perbaikan.` };
  return            { label: 'Perlu Ditingkatkan',      color: '#ea580c', desc: `Model hanya menjelaskan ${(r2*100).toFixed(1)}% variasi data — coba naikkan neuron atau epochs.` };
};

window.GreenSense.interpretAccuracy = function(acc) {
  if (acc >= 0.90) return { label: 'Sangat Baik',      color: '#16a34a', desc: `${(acc*100).toFixed(1)}% prediksi kategori benar — model sangat handal untuk klasifikasi.` };
  if (acc >= 0.75) return { label: 'Baik',             color: '#ca8a04', desc: `${(acc*100).toFixed(1)}% prediksi benar — model layak digunakan dengan catatan kehati-hatian.` };
  return            { label: 'Perlu Diperbaiki',        color: '#ea580c', desc: `Hanya ${(acc*100).toFixed(1)}% prediksi benar — coba tambah neurons atau epoch lebih banyak.` };
};

window.GreenSense.interpretPollutant = function(name, value) {
  const thresholds = {
    pm10: [{ max:50, label:'Normal', color:'#16a34a' }, { max:150, label:'Sedang', color:'#ca8a04' },
           { max:350, label:'Tinggi', color:'#ea580c' }, { max:9999, label:'Sangat Tinggi', color:'#dc2626' }],
    pm25: [{ max:15, label:'Normal', color:'#16a34a' }, { max:55,  label:'Sedang', color:'#ca8a04' },
           { max:150, label:'Tinggi', color:'#ea580c' }, { max:9999, label:'Sangat Tinggi', color:'#dc2626' }],
    so2:  [{ max:20, label:'Normal', color:'#16a34a' }, { max:80,  label:'Sedang', color:'#ca8a04' },
           { max:9999, label:'Tinggi', color:'#ea580c' }],
    co:   [{ max:30, label:'Normal', color:'#16a34a' }, { max:60,  label:'Sedang', color:'#ca8a04' },
           { max:9999, label:'Tinggi', color:'#ea580c' }],
    o3:   [{ max:50, label:'Normal', color:'#16a34a' }, { max:100, label:'Sedang', color:'#ca8a04' },
           { max:9999, label:'Tinggi', color:'#ea580c' }],
    no2:  [{ max:40, label:'Normal', color:'#16a34a' }, { max:100, label:'Sedang', color:'#ca8a04' },
           { max:9999, label:'Tinggi', color:'#ea580c' }],
  };
  const key   = name.toLowerCase().replace('.', '');
  const scale = thresholds[key] || [];
  for (const t of scale) {
    if (value <= t.max) return t;
  }
  return { label: 'Tidak Diketahui', color: '#64748b' };
};

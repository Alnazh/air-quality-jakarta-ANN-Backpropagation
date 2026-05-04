/**
 * upload_dataset.js — Upload & Reset Dataset
 */
'use strict';

let selectedFile = null;

// ── Drop zone ─────────────────────────────────────────────────────────
function handleDrop(e) {
  e.preventDefault();
  const zone = document.getElementById('dropZone');
  zone.style.borderColor = '#cbd5e1';
  zone.style.background  = '#f8fafc';
  const file = e.dataTransfer.files[0];
  if (file) setFile(file);
}

function handleFileSelect(input) {
  if (input.files[0]) setFile(input.files[0]);
}

function setFile(file) {
  const allowed = ['.csv', '.xlsx', '.xls'];
  const ext     = '.' + file.name.split('.').pop().toLowerCase();
  if (!allowed.includes(ext)) {
    GreenSense.toast('Format tidak didukung. Gunakan CSV atau XLSX.', 'danger');
    return;
  }
  selectedFile = file;
  document.getElementById('fileName').textContent = file.name;
  document.getElementById('fileSize').textContent  =
    `${(file.size / 1024).toFixed(1)} KB`;
  document.getElementById('filePreview').classList.remove('d-none');
  document.getElementById('btnUpload').disabled = false;

  // Update drop zone appearance
  const zone = document.getElementById('dropZone');
  zone.style.borderColor = '#1fa97a';
  zone.style.background  = '#f0fdf4';
}

function clearFile() {
  selectedFile = null;
  document.getElementById('fileInput').value = '';
  document.getElementById('filePreview').classList.add('d-none');
  document.getElementById('btnUpload').disabled = true;
  document.getElementById('uploadResult').classList.add('d-none');
  const zone = document.getElementById('dropZone');
  zone.style.borderColor = '#cbd5e1';
  zone.style.background  = '#f8fafc';
}

// ── Upload ────────────────────────────────────────────────────────────
document.getElementById('btnUpload')?.addEventListener('click', async () => {
  if (!selectedFile) return;

  const btn = document.getElementById('btnUpload');
  btn.disabled  = true;
  btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Mengupload…';
  GreenSense.showLoader('Memvalidasi & memuat dataset…');

  try {
    const formData = new FormData();
    formData.append('dataset_file', selectedFile);

    const res  = await fetch('/upload-dataset', { method: 'POST', body: formData });
    const data = await res.json();
    GreenSense.hideLoader();

    if (data.success) {
      const info = data.info;
      document.getElementById('uploadResult').classList.remove('d-none');
      document.getElementById('uploadResult').innerHTML = `
        <div class="alert alert-success d-flex gap-2 align-items-start">
          <i class="ti ti-check-circle flex-shrink-0" style="font-size:1.3rem;margin-top:2px"></i>
          <div>
            <div class="fw-600 mb-1">Dataset berhasil diupload!</div>
            <div style="font-size:.83rem">
              <span class="badge bg-success-subtle text-success me-1">${info.rows.toLocaleString()} record</span>
              <span class="badge bg-primary-subtle text-primary me-1">${info.stations} stasiun</span>
              <span class="badge bg-light text-dark border">${info.date_from} – ${info.date_to}</span>
            </div>
            <div class="mt-2 text-muted" style="font-size:.78rem">
              Dataset aktif sekarang. Buka halaman Dataset ISPU untuk melihat data baru.
            </div>
          </div>
        </div>`;

      // Update status banner
      const banner = document.getElementById('statusBanner');
      banner.className = 'mb-3 alert alert-warning d-flex align-items-center gap-2';
      banner.innerHTML = `
        <i class="ti ti-database-import flex-shrink-0" style="font-size:1.3rem"></i>
        <div><strong>Dataset Kustom Aktif</strong> — "${selectedFile.name}" sedang digunakan.
        Klik "Reset ke Dataset Bawaan" untuk kembali ke data ISPU Jakarta 2010–2025.</div>`;

      document.getElementById('btnReset').disabled = false;
      GreenSense.toast('Dataset berhasil diupload!', 'success');

    } else {
      document.getElementById('uploadResult').classList.remove('d-none');
      document.getElementById('uploadResult').innerHTML = `
        <div class="alert alert-danger">
          <i class="ti ti-x-circle me-2"></i><strong>Upload gagal:</strong> ${data.error}
        </div>`;
      GreenSense.toast('Upload gagal: ' + data.error, 'danger');
    }

  } catch (err) {
    GreenSense.hideLoader();
    GreenSense.toast('Terjadi kesalahan: ' + err.message, 'danger');
  } finally {
    btn.disabled  = false;
    btn.innerHTML = '<i class="ti ti-upload me-1"></i>Upload &amp; Gunakan Dataset Ini';
  }
});

// ── Reset ─────────────────────────────────────────────────────────────
document.getElementById('btnReset')?.addEventListener('click', async () => {
  if (!confirm('Reset ke dataset bawaan? Dataset yang diupload akan dihapus.')) return;

  GreenSense.showLoader('Mereset dataset…');
  const res  = await GreenSense.fetchAPI('/api/reset-dataset',
    { method: 'POST', headers: {'Content-Type':'application/json'}, body: '{}' });
  GreenSense.hideLoader();

  if (res.success) {
    // Update banner
    const banner = document.getElementById('statusBanner');
    banner.className = 'mb-3 alert alert-success d-flex align-items-center gap-2';
    banner.innerHTML = `
      <i class="ti ti-database flex-shrink-0" style="font-size:1.3rem"></i>
      <div><strong>Dataset Bawaan Aktif</strong> — Menggunakan data ISPU Jakarta 2010–2025
      (Kaggle + Satudata DKI, 27.863 record).</div>`;
    document.getElementById('btnReset').disabled = true;
    clearFile();
    document.getElementById('uploadResult').classList.add('d-none');
    GreenSense.toast('Dataset berhasil direset!', 'success');
  } else {
    GreenSense.toast('Reset gagal: ' + res.error, 'danger');
  }
});

// ── Download CSV template ─────────────────────────────────────────────
function downloadTemplate() {
  const header = 'tanggal,stasiun,pm10,pm25,so2,co,o3,no2,max,critical,categori\n';
  const rows = [
    '2024-01-01,DKI1 (Bunderan HI),85.2,42.1,14.3,17.8,44.2,19.1,67.8,PM10,SEDANG',
    '2024-01-01,DKI2 (Kelapa Gading),110.5,58.3,18.7,22.4,51.3,24.6,88.4,PM10,SEDANG',
    '2024-01-02,DKI1 (Bunderan HI),95.7,51.2,16.8,20.3,48.7,22.1,76.6,PM25,SEDANG',
    '2024-01-02,DKI3 (Jagakarsa),130.4,70.1,22.3,28.6,61.8,30.4,104.1,PM25,TIDAK SEHAT',
  ].join('\n');

  const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = 'template_ispu_jakarta.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  GreenSense.toast('Template CSV berhasil didownload!', 'success');
}

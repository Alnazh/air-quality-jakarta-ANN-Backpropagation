# 🌿 GreenSense Jakarta

Aplikasi web prediksi kualitas udara Jakarta berbasis **Artificial Neural Network (ANN) Backpropagation**.  
Dibangun sebagai tugas mata kuliah Kecerdasan Buatan — Teknik Informatika.

---

## ✨ Fitur

| Fitur | Keterangan |
|---|---|
| Dashboard | Statistik dan visualisasi data ISPU Jakarta 2010–2025 |
| Dataset | Eksplorasi tabel data, filter stasiun, dan distribusi kategori |
| Pelatihan Model | Training ANN dengan konfigurasi epoch, hidden layer, dan learning rate |
| Evaluasi Model | Confusion matrix, akurasi, loss, dan metrik per kelas |
| Prediksi | Input manual polutan untuk prediksi kategori ISPU secara real-time |
| Upload Dataset | Ganti dataset dengan file CSV custom sesuai format yang ditentukan |

---

## 🛠️ Tech Stack

- **Backend** — Python 3.10+, Flask 3.0
- **Machine Learning** — TensorFlow 2.14, Scikit-learn
- **Data Processing** — Pandas, NumPy
- **Frontend** — HTML5, Bootstrap 5, Chart.js, Tabler Icons

---

## 📁 Struktur Proyek

```
air_quality_jakarta/
├── app.py                  # Entry point Flask
├── requirements.txt
├── data/
│   └── ispu_jakarta_2010_2025.csv
├── models/                 # File model hasil training (tidak di-commit)
├── static/
│   ├── css/
│   └── js/
├── templates/
│   ├── base.html
│   ├── dashboard.html
│   ├── dataset.html
│   ├── evaluasi.html
│   ├── prediksi.html
│   ├── upload_dataset.html
│   ├── panduan.html
│   └── tentang.html
└── utils/
    ├── data_loader.py
    ├── model_manager.py
    └── preprocessor.py
```

---

## 🚀 Cara Menjalankan

**1. Clone repository**
```bash
git clone https://github.com/Alnazh/greensense-jakarta.git
cd greensense-jakarta
```

**2. Buat virtual environment**
```bash
python -m venv venv
source venv/bin/activate        # Linux / macOS
venv\Scripts\activate           # Windows
```

**3. Install dependencies**
```bash
pip install -r requirements.txt
```

**4. Jalankan aplikasi**
```bash
python app.py
```

Buka browser dan akses `http://localhost:5000`

---

## 📊 Dataset

Dataset ISPU Jakarta yang digunakan bersumber dari:

- [Kaggle — Jakarta Air Quality (2010–2021)](https://www.kaggle.com/datasets/senadu34/air-quality-index-in-jakarta-2010-2021)
- [Satu Data Indonesia — ISPU Jakarta (2022–2025)](https://satudata.jakarta.go.id)

Kolom wajib dataset: `tanggal`, `stasiun`, `pm10`, `pm25`, `so2`, `co`, `o3`, `no2`, `max`, `categori`

---

## 👩‍💻 Developer

**Aulia Nazwa Huriah**  
Mahasiswa Teknik Informatika  

---

## 📄 Lisensi

Proyek ini dibuat untuk keperluan akademik.

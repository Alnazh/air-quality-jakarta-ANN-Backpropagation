"""
app.py — GreenSense Jakarta
Prediksi Kualitas Udara (ISPU) Jakarta — ANN Backpropagation
Tugas 7 Kecerdasan Buatan — Teknik Informatika
"""
import os, warnings, logging, json, io
warnings.filterwarnings('ignore')
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'
os.environ['TF_ENABLE_ONEDNN_OPTS'] = '0'

from flask import Flask, render_template, request, jsonify, Response, stream_with_context
import pandas as pd
import datetime

from utils.data_loader   import (load_data, get_stations, get_summary_stats,
                                  get_chart_data, get_monthly_chart,
                                  get_yearly_chart, get_category_distribution,
                                  get_pollutant_correlation, get_table_data)
from utils.model_manager  import ModelManager

logging.basicConfig(level=logging.INFO,
                    format='%(asctime)s [%(levelname)s] %(message)s')
log = logging.getLogger(__name__)

app = Flask(__name__)
app.secret_key = 'greensense-aq-secret-2024'
app.jinja_env.globals.update(enumerate=enumerate, zip=zip, len=len)

@app.context_processor
def inject_now():
    return {'now': datetime.datetime.now()}

# ModelManager loads TF at import time → no cold-start during requests
model_manager = ModelManager()
log.info("GreenSense Jakarta ready — TF pre-loaded ✓")

DATA_DIR      = os.path.join(os.path.dirname(__file__), 'data')
MAIN_CSV_NAME = 'ispu_jakarta_2010_2025.csv'
DEFAULT_CSV   = os.path.join(DATA_DIR, MAIN_CSV_NAME)
UPLOAD_CSV    = os.path.join(DATA_DIR, 'ispu_upload.csv')

# ── REQUIRED COLUMNS for any uploaded dataset ─────────────────────────
REQUIRED_COLS = {'tanggal', 'stasiun', 'pm10', 'pm25', 'so2', 'co', 'o3', 'no2', 'max', 'categori'}


# ══════════════════════════════════════════════════════════════════════
#  DASHBOARD
# ══════════════════════════════════════════════════════════════════════
@app.route('/')
def dashboard():
    return render_template('dashboard.html', page='dashboard',
                           stats=get_summary_stats(), stations=get_stations(),
                           trained=model_manager.get_global_stats())


# ══════════════════════════════════════════════════════════════════════
#  DATASET
# ══════════════════════════════════════════════════════════════════════
@app.route('/dataset')
def dataset():
    using_upload = os.path.exists(UPLOAD_CSV)
    return render_template('dataset.html', page='dataset',
                           stations=get_stations(),
                           years=list(range(2010, 2026)),
                           using_upload=using_upload)

@app.route('/api/chart-data')
def api_chart_data():
    return jsonify({'success': True,
                    'data': get_chart_data(request.args.get('station','all'),
                                           int(request.args.get('limit', 365)))})

@app.route('/api/monthly-chart')
def api_monthly_chart():
    return jsonify({'success': True,
                    'data': get_monthly_chart(request.args.get('station','all'))})

@app.route('/api/yearly-chart')
def api_yearly_chart():
    return jsonify({'success': True, 'data': get_yearly_chart()})

@app.route('/api/category-dist')
def api_category_dist():
    return jsonify({'success': True, 'data': get_category_distribution()})

@app.route('/api/correlation')
def api_correlation():
    return jsonify({'success': True, 'data': get_pollutant_correlation()})

@app.route('/api/table')
def api_table():
    data = get_table_data(
        int(request.args.get('page', 1)),
        int(request.args.get('per_page', 20)),
        request.args.get('station', 'all'),
        int(request.args.get('year', 0)),
        request.args.get('category', 'all'),
        request.args.get('sort_col', 'tanggal'),
        request.args.get('sort_dir', 'asc'),
    )
    return jsonify({'success': True, 'data': data})


# ══════════════════════════════════════════════════════════════════════
#  UPLOAD DATASET
# ══════════════════════════════════════════════════════════════════════
@app.route('/upload-dataset', methods=['GET', 'POST'])
def upload_dataset():
    if request.method == 'POST':
        f = request.files.get('dataset_file')
        if not f or f.filename == '':
            return jsonify({'success': False, 'error': 'Tidak ada file yang dipilih.'}), 400

        fname = f.filename.lower()
        try:
            if fname.endswith('.csv'):
                df = pd.read_csv(io.BytesIO(f.read()))
            elif fname.endswith(('.xlsx', '.xls')):
                df = pd.read_excel(io.BytesIO(f.read()))
            else:
                return jsonify({'success': False,
                                'error': 'Format tidak didukung. Gunakan CSV atau XLSX.'}), 400

            # Normalize column names
            df.columns = [c.strip().lower().replace(' ', '_') for c in df.columns]

            # Validate required columns
            missing = REQUIRED_COLS - set(df.columns)
            if missing:
                return jsonify({'success': False,
                                'error': f'Kolom wajib tidak ditemukan: {", ".join(sorted(missing))}'}), 400

            # Validate tanggal
            df['tanggal'] = pd.to_datetime(df['tanggal'], errors='coerce')
            if df['tanggal'].isna().all():
                return jsonify({'success': False,
                                'error': 'Kolom tanggal tidak dapat diparse. Gunakan format YYYY-MM-DD.'}), 400

            df = df.dropna(subset=['tanggal'])
            df = df.sort_values('tanggal').reset_index(drop=True)

            # Save as upload
            df.to_csv(UPLOAD_CSV, index=False)

            # Reload cache
            from utils import data_loader
            data_loader._df_cache = None

            return jsonify({
                'success': True,
                'info': {
                    'rows'      : len(df),
                    'stations'  : df['stasiun'].nunique() if 'stasiun' in df.columns else 0,
                    'date_from' : df['tanggal'].min().strftime('%d %b %Y'),
                    'date_to'   : df['tanggal'].max().strftime('%d %b %Y'),
                    'columns'   : df.columns.tolist(),
                }
            })

        except Exception as e:
            return jsonify({'success': False, 'error': str(e)}), 500

    using_upload = os.path.exists(UPLOAD_CSV)
    return render_template('upload_dataset.html', page='upload',
                           using_upload=using_upload,
                           required_cols=sorted(REQUIRED_COLS))


@app.route('/api/reset-dataset', methods=['POST'])
def reset_dataset():
    """Kembali ke dataset bawaan."""
    try:
        if os.path.exists(UPLOAD_CSV):
            os.remove(UPLOAD_CSV)
        from utils import data_loader
        data_loader._df_cache = None
        return jsonify({'success': True,
                        'message': 'Dataset berhasil direset ke data bawaan (2010–2025).'})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/dataset-status')
def api_dataset_status():
    using_upload = os.path.exists(UPLOAD_CSV)
    df = load_data()
    return jsonify({'success': True, 'data': {
        'using_upload': using_upload,
        'rows'        : len(df),
        'date_from'   : df['tanggal'].min().strftime('%d %b %Y'),
        'date_to'     : df['tanggal'].max().strftime('%d %b %Y'),
        'stations'    : get_stations(),
    }})


# ══════════════════════════════════════════════════════════════════════
#  PREDIKSI (Train + Predict) — with streaming progress
# ══════════════════════════════════════════════════════════════════════
@app.route('/prediksi')
def prediksi():
    return render_template('prediksi.html', page='prediksi',
                           stations=get_stations())

@app.route('/api/train', methods=['POST'])
def api_train():
    try:
        b = request.get_json(force=True)
        result = model_manager.train(
            station    = b.get('station', 'all'),
            mode       = b.get('mode', 'regression'),
            epochs     = int(b.get('epochs', 100)),
            h1         = int(b.get('h1', 64)),
            h2         = int(b.get('h2', 32)),
            h3         = int(b.get('h3', 16)),
            dropout    = float(b.get('dropout', 0.15)),
            lr         = float(b.get('lr', 0.001)),
            batch_size = int(b.get('batch_size', 128)),
            patience   = int(b.get('patience', 10)),
        )
        return jsonify({'success': True, 'data': result})
    except Exception as e:
        log.error(f"Train error: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/predict', methods=['POST'])
def api_predict():
    try:
        b = request.get_json(force=True)
        result = model_manager.predict(
            station    = b.get('station', 'all'),
            mode       = b.get('mode', 'regression'),
            input_data = {
                'pm10'         : float(b.get('pm10', 50)),
                'pm25'         : float(b.get('pm25', 30)),
                'so2'          : float(b.get('so2', 10)),
                'co'           : float(b.get('co', 10)),
                'o3'           : float(b.get('o3', 30)),
                'no2'          : float(b.get('no2', 15)),
                'bulan'        : int(b.get('bulan', 6)),
                'day_of_week'  : int(b.get('day_of_week', 0)),
                'is_dry_season': int(b.get('is_dry_season', 0)),
            }
        )
        if 'error' in result:
            return jsonify({'success': False, 'error': result['error']}), 400
        return jsonify({'success': True, 'data': result})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


# ══════════════════════════════════════════════════════════════════════
#  EVALUASI
# ══════════════════════════════════════════════════════════════════════
@app.route('/evaluasi')
def evaluasi():
    return render_template('evaluasi.html', page='evaluasi',
                           stations=get_stations(),
                           trained=model_manager.list_trained())

@app.route('/api/evaluasi')
def api_evaluasi():
    meta = model_manager.get_metadata(
        request.args.get('station', 'all'),
        request.args.get('mode', 'regression')
    )
    if meta:
        return jsonify({'success': True, 'data': meta})
    return jsonify({'success': False,
                    'error': 'Model belum dilatih untuk kombinasi ini.'}), 404


# ══════════════════════════════════════════════════════════════════════
#  PANDUAN
# ══════════════════════════════════════════════════════════════════════
@app.route('/panduan')
def panduan():
    return render_template('panduan.html', page='panduan')


# ══════════════════════════════════════════════════════════════════════
#  TENTANG
# ══════════════════════════════════════════════════════════════════════
@app.route('/tentang')
def tentang():
    return render_template('tentang.html', page='tentang')


if __name__ == '__main__':
    log.info("Starting GreenSense Jakarta on http://127.0.0.1:5000")
    app.run(debug=True, port=5000)

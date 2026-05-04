"""
utils/data_loader.py
Dataset ISPU Jakarta — otomatis pakai upload jika ada, fallback ke bawaan.
"""
import os
import pandas as pd
import numpy as np

DATA_DIR     = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'data')
DEFAULT_CSV  = os.path.join(DATA_DIR, 'ispu_jakarta_2010_2025.csv')
UPLOAD_CSV   = os.path.join(DATA_DIR, 'ispu_upload.csv')

_df_cache = None


def _active_csv():
    return UPLOAD_CSV if os.path.exists(UPLOAD_CSV) else DEFAULT_CSV


def load_data(force_reload=False):
    global _df_cache
    if _df_cache is not None and not force_reload:
        return _df_cache.copy()
    df = pd.read_csv(_active_csv(), parse_dates=['tanggal'])
    df = df.sort_values('tanggal').reset_index(drop=True)
    for col in ['pm10','pm25','so2','co','o3','no2','max']:
        df[col] = pd.to_numeric(df[col], errors='coerce')
    df['tahun']  = df['tanggal'].dt.year
    df['bulan']  = df['tanggal'].dt.month
    df['hari']   = df['tanggal'].dt.day
    _df_cache = df
    return df.copy()


def get_stations():
    return sorted(load_data()['stasiun'].unique().tolist())


def get_summary_stats():
    df   = load_data()
    cat_counts = df['categori'].value_counts().to_dict()
    total_cat  = sum(cat_counts.values())
    worst = df.loc[df['max'].idxmax()]
    best  = df.loc[df['max'].idxmin()]
    return {
        'total_records': len(df),
        'date_range'   : f"{df['tanggal'].min().strftime('%d %b %Y')} – {df['tanggal'].max().strftime('%d %b %Y')}",
        'avg_ispu'     : round(df['max'].mean(), 1),
        'n_stations'   : df['stasiun'].nunique(),
        'cat_counts'   : cat_counts,
        'cat_pct'      : {k: round(v/total_cat*100,1) for k,v in cat_counts.items()},
        'worst_day'    : {'tanggal': worst['tanggal'].strftime('%d %b %Y'),
                          'max': round(worst['max'],1), 'stasiun': worst['stasiun'],
                          'categori': worst['categori']},
        'best_day'     : {'tanggal': best['tanggal'].strftime('%d %b %Y'),
                          'max': round(best['max'],1), 'stasiun': best['stasiun'],
                          'categori': best['categori']},
        'yearly_avg'   : df.groupby('tahun')['max'].mean().round(1).to_dict(),
        'using_upload' : os.path.exists(UPLOAD_CSV),
    }


def get_chart_data(station=None, limit=365):
    df = load_data()
    if station and station != 'all':
        df = df[df['stasiun'] == station]
    daily = (df.groupby('tanggal')[['pm10','pm25','so2','co','o3','no2','max']]
               .mean().round(2).reset_index().tail(limit))
    return {k: daily[k if k != 'ispu' else 'max'].tolist() if k != 'dates' and k != 'ispu'
            else (daily['tanggal'].dt.strftime('%Y-%m-%d').tolist() if k == 'dates'
                  else daily['max'].tolist())
            for k in ['dates','pm10','pm25','so2','co','o3','no2','ispu']}


def get_monthly_chart(station=None):
    df = load_data()
    if station and station != 'all':
        df = df[df['stasiun'] == station]
    df['ym'] = df['tanggal'].dt.to_period('M')
    m = (df.groupby('ym')[['pm10','pm25','so2','co','o3','no2','max']]
           .mean().round(2).reset_index())
    return {'labels': m['ym'].astype(str).tolist(),
            **{k: m[k].tolist() for k in ['pm10','pm25','so2','co','o3','no2']},
            'ispu': m['max'].tolist()}


def get_yearly_chart():
    df = load_data()
    y  = df.groupby('tahun')['max'].mean().round(2).reset_index()
    return {'years': y['tahun'].tolist(), 'values': y['max'].tolist()}


def get_category_distribution():
    return load_data()['categori'].value_counts().to_dict()


def get_pollutant_correlation():
    df   = load_data()
    cols = ['pm10','pm25','so2','co','o3','no2']
    corr = df[cols].corr().round(3)
    return {'labels': cols, 'matrix': corr.values.tolist()}


def get_table_data(page=1, per_page=20, station=None, year=None,
                   category=None, sort_col='tanggal', sort_dir='asc'):
    df = load_data()
    if station and station != 'all': df = df[df['stasiun'] == station]
    if year and year != 0:           df = df[df['tahun'] == int(year)]
    if category and category != 'all': df = df[df['categori'] == category]

    # Sort
    valid_cols = {'tanggal', 'max', 'pm10', 'pm25', 'so2', 'co', 'o3', 'no2'}
    col = sort_col if sort_col in valid_cols else 'tanggal'
    asc = sort_dir != 'desc'
    df  = df.sort_values(col, ascending=asc)

    total       = len(df)
    total_pages = max(1, (total + per_page - 1) // per_page)
    page        = max(1, min(page, total_pages))
    subset      = df.iloc[(page-1)*per_page : page*per_page]
    records = [{'tanggal': r['tanggal'].strftime('%Y-%m-%d'), 'stasiun': r['stasiun'],
                'pm10': r['pm10'], 'pm25': r['pm25'], 'so2': r['so2'],
                'co': r['co'], 'o3': r['o3'], 'no2': r['no2'],
                'max': r['max'], 'critical': r['critical'], 'categori': r['categori']}
               for _, r in subset.iterrows()]
    return {'records': records, 'total': total, 'page': page,
            'per_page': per_page, 'total_pages': total_pages}

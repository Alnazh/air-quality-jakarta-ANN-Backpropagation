"""
utils/preprocessor.py
Preprocessing data ISPU Jakarta untuk model Backpropagation ANN.
Tahapan: cleaning → feature engineering → normalisasi → split
"""

import numpy as np
import pandas as pd
from sklearn.preprocessing import MinMaxScaler
from sklearn.model_selection import train_test_split


FEATURES = ['pm10', 'pm25', 'so2', 'co', 'o3', 'no2',
            'bulan', 'day_of_week', 'is_dry_season']
TARGET   = 'max'   # ISPU maksimum (nilai kontinu untuk regresi)

# Mapping kategori ISPU → integer (untuk klasifikasi jika diperlukan)
CATEGORY_MAP = {
    'BAIK'               : 0,
    'SEDANG'             : 1,
    'TIDAK SEHAT'        : 2,
    'SANGAT TIDAK SEHAT' : 3,
    'BERBAHAYA'          : 4,
}


def engineer_features(df: pd.DataFrame) -> pd.DataFrame:
    """Tambah fitur waktu yang berguna."""
    df = df.copy()
    df['day_of_week']  = df['tanggal'].dt.dayofweek
    df['is_dry_season'] = df['tanggal'].dt.month.isin([6, 7, 8, 9]).astype(int)
    df['cat_label']    = df['categori'].map(CATEGORY_MAP)
    return df


def clean_data(df: pd.DataFrame) -> pd.DataFrame:
    """Hapus baris dengan nilai hilang pada kolom kritis."""
    df = df.copy()
    num_cols = ['pm10', 'pm25', 'so2', 'co', 'o3', 'no2', 'max']
    df[num_cols] = df[num_cols].apply(pd.to_numeric, errors='coerce')
    df = df.dropna(subset=num_cols)
    # Clip nilai ekstrim (IQR × 3)
    for col in num_cols:
        q1, q3 = df[col].quantile(0.25), df[col].quantile(0.75)
        iqr = q3 - q1
        df[col] = df[col].clip(lower=q1 - 3 * iqr, upper=q3 + 3 * iqr)
    return df


def prepare_regression(df: pd.DataFrame, station: str = None,
                        test_size: float = 0.2):
    """
    Siapkan data untuk regresi (prediksi nilai ISPU numerik).
    Return: X_train, X_test, y_train, y_test, scaler_X, scaler_y, feature_names
    """
    df = clean_data(df)
    df = engineer_features(df)

    if station and station != 'all':
        df = df[df['stasiun'] == station]

    df = df.dropna(subset=FEATURES + [TARGET])

    X = df[FEATURES].values.astype(np.float32)
    y = df[TARGET].values.astype(np.float32).reshape(-1, 1)

    scaler_X = MinMaxScaler()
    scaler_y = MinMaxScaler()

    X_scaled = scaler_X.fit_transform(X)
    y_scaled = scaler_y.fit_transform(y)

    X_train, X_test, y_train, y_test = train_test_split(
        X_scaled, y_scaled, test_size=test_size, random_state=42, shuffle=True
    )

    return X_train, X_test, y_train, y_test, scaler_X, scaler_y, FEATURES


def prepare_classification(df: pd.DataFrame, station: str = None,
                            test_size: float = 0.2):
    """
    Siapkan data untuk klasifikasi kategori ISPU (5 kelas).
    Return: X_train, X_test, y_train, y_test, scaler_X, n_classes
    """
    df = clean_data(df)
    df = engineer_features(df)

    if station and station != 'all':
        df = df[df['stasiun'] == station]

    df = df.dropna(subset=FEATURES + ['cat_label'])

    X = df[FEATURES].values.astype(np.float32)
    y = df['cat_label'].values.astype(int)

    scaler_X = MinMaxScaler()
    X_scaled = scaler_X.fit_transform(X)

    X_train, X_test, y_train, y_test = train_test_split(
        X_scaled, y, test_size=test_size, random_state=42, stratify=y
    )

    n_classes = len(CATEGORY_MAP)
    return X_train, X_test, y_train, y_test, scaler_X, n_classes


def get_latest_features(df: pd.DataFrame, station: str, scaler_X) -> np.ndarray:
    """Ambil fitur terbaru dari dataset untuk prediksi satu data."""
    df = clean_data(df)
    df = engineer_features(df)
    if station and station != 'all':
        df = df[df['stasiun'] == station]
    latest = df.sort_values('tanggal').tail(1)
    X = latest[FEATURES].values.astype(np.float32)
    return scaler_X.transform(X)

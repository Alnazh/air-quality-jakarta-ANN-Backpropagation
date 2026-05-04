/**
 * dashboard.js — GreenSense Dashboard
 */
'use strict';

document.addEventListener('DOMContentLoaded', async () => {
  const def = GreenSense.chartDefaults();

  // ── Chart 1: ISPU tren BULANAN (menggantikan harian yg bertumpuk) ─────
  const monthRes = await GreenSense.fetchAPI('/api/monthly-chart?station=all');
  if (monthRes.success) {
    const d = monthRes.data;
    new ApexCharts(document.getElementById('chartIspuMonthly'), {
      ...def,
      chart: { ...def.chart, type: 'area', height: 280 },
      series: [{ name: 'ISPU Maks (rata-rata bulanan)', data: d.ispu }],
      xaxis : {
        categories: d.labels,
        tickAmount: 16,
        labels: {
          rotate: -35,
          rotateAlways: false,
          hideOverlappingLabels: true,
          formatter: v => v ? v.slice(0, 7) : '',
          style: { fontSize: '10px' }
        }
      },
      yaxis : { title: { text: 'Nilai ISPU' }, min: 0 },
      colors: ['#1fa97a'],
      fill  : { type: 'gradient', gradient: {
        shadeIntensity: 1, opacityFrom: .4, opacityTo: .05, stops: [0, 90, 100]
      }},
      annotations: {
        yaxis: [
          { y: 50,  borderColor: '#16a34a', label: { text: 'Baik',     style: { color: '#fff', background: '#16a34a' } } },
          { y: 100, borderColor: '#ca8a04', label: { text: 'Sedang',   style: { color: '#fff', background: '#ca8a04' } } },
          { y: 199, borderColor: '#ea580c', label: { text: 'Tdk Sehat',style: { color: '#fff', background: '#ea580c' } } },
        ]
      },
      dataLabels: { enabled: false },
      tooltip: { ...def.tooltip, x: { format: 'MMM yyyy' } },
    }).render();
  }

  // ── Chart 2: Yearly average bar ───────────────────────────────────────
  const yrRes = await GreenSense.fetchAPI('/api/yearly-chart');
  if (yrRes.success) {
    const d = yrRes.data;
    new ApexCharts(document.getElementById('chartYearly'), {
      ...def,
      chart  : { ...def.chart, type: 'bar', height: 240 },
      series : [{ name: 'Rata-rata ISPU', data: d.values }],
      xaxis  : { categories: d.years },
      colors : ['#2563eb'],
      plotOptions: { bar: { borderRadius: 6, columnWidth: '60%' } },
      dataLabels : { enabled: false },
    }).render();
  }

  // ── Chart 3: Category donut ───────────────────────────────────────────
  const catRes = await GreenSense.fetchAPI('/api/category-dist');
  if (catRes.success) {
    const d      = catRes.data;
    const labels = Object.keys(d);
    const values = Object.values(d);
    const colors = labels.map(l => GreenSense.getCatMeta(l).color);
    new ApexCharts(document.getElementById('chartCategory'), {
      ...def,
      chart  : { ...def.chart, type: 'donut', height: 240 },
      series : values,
      labels : labels,
      colors : colors,
      legend : { position: 'bottom', fontSize: '12px' },
      plotOptions: { pie: { donut: { size: '68%',
        labels: { show: true,
          total: { show: true, label: 'Total', formatter: w =>
            w.globals.seriesTotals.reduce((a, b) => a + b, 0).toLocaleString()
          }
        }
      }}},
    }).render();
  }

  // ── Chart 4: Pollutant radar (30 hari terakhir) ───────────────────────
  const chartRes = await GreenSense.fetchAPI('/api/chart-data?station=all&limit=30');
  if (chartRes.success) {
    const d   = chartRes.data;
    const avg = k => d[k].length ? d[k].reduce((a, b) => a + b, 0) / d[k].length : 0;
    new ApexCharts(document.getElementById('chartRadar'), {
      ...def,
      chart  : { ...def.chart, type: 'radar', height: 240 },
      series : [{ name: 'Rata-rata 30 hari', data: [
        +avg('pm10').toFixed(1), +avg('pm25').toFixed(1),
        +avg('so2').toFixed(1),  +avg('co').toFixed(1),
        +avg('o3').toFixed(1),   +avg('no2').toFixed(1),
      ]}],
      xaxis  : { categories: ['PM10', 'PM25', 'SO2', 'CO', 'O3', 'NO2'] },
      colors : ['#1fa97a'],
      fill   : { opacity: .2 },
      markers: { size: 4 },
    }).render();
  }
});

// ── Interpretasi ISPU avg card ────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const avgEl = document.getElementById('avgIspuInterpret');
  if (!avgEl) return;
  const val    = parseFloat(avgEl.dataset.value || 0);
  const interp = GreenSense.interpretISPU(val);
  avgEl.innerHTML = `<span style="color:${interp.color};font-size:.75rem;font-weight:500">
    <i class="ti ${interp.icon} me-1"></i>${interp.label}
  </span>`;
});

// ── ANN Architecture Diagram ──────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  renderANNDiagram('annDiagram');
});

function renderANNDiagram(containerId, h1=64, h2=32, h3=16, mode='regression') {
  const el = document.getElementById(containerId);
  if (!el) return;

  // Canvas dimensions — wider for full-width card
  const W   = 900;
  const H   = 320;
  const R   = 20;   // node radius
  const GAP = 10;   // gap between nodes

  // Layer definitions
  const inputNames = ['PM10','PM25','SO₂','CO','O₃','NO₂','Bulan','Hari','Musim'];
  const outputNames = mode === 'regression'
    ? ['Nilai ISPU']
    : ['BAIK','SEDANG','TDK SEHAT','SANGAT TDK','BERBAHAYA'];
  const outputN = outputNames.length;

  const layers = [
    { id: 'input',  label: 'Input Layer',        sub: '9 fitur polutan',     n: 9,     showN: 9,  color: '#2563eb', names: inputNames },
    { id: 'h1',     label: `Hidden 1`,            sub: `${h1} neuron · ReLU`, n: h1,    showN: 6,  color: '#059669', names: null },
    { id: 'h2',     label: `Hidden 2`,            sub: `${h2} neuron · ReLU`, n: h2,    showN: 5,  color: '#059669', names: null },
    { id: 'h3',     label: `Hidden 3`,            sub: `${h3} neuron · ReLU`, n: h3,    showN: 4,  color: '#059669', names: null },
    { id: 'output', label: mode === 'regression' ? 'Output' : 'Output',
      sub: mode === 'regression' ? '1 nilai ISPU' : '5 kategori · Softmax',
      n: outputN, showN: outputN, color: '#7c3aed', names: outputNames },
  ];

  // X positions spread across width
  const layerX = [90, 240, 390, 540, 780];

  // Calculate Y positions for each layer
  function getYs(showN, totalH, r, gap) {
    const totalHeight = showN * (r * 2) + (showN - 1) * gap;
    const startY = (totalH - totalHeight) / 2 + r;
    return Array.from({length: showN}, (_, i) => startY + i * (r * 2 + gap));
  }

  const layerYs = layers.map(l => getYs(l.showN, H - 50, R, GAP));

  let svg = `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg"
    style="width:100%;height:auto;max-height:320px;font-family:'Plus Jakarta Sans',sans-serif">
  <defs>
    <filter id="glow" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="3" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <marker id="arrowFwd" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
      <polygon points="0 0, 7 3.5, 0 7" fill="#cbd5e1" opacity="0.6"/>
    </marker>
    <marker id="arrowBack" markerWidth="7" markerHeight="7" refX="1" refY="3.5" orient="auto">
      <polygon points="7 0, 0 3.5, 7 7" fill="#f59e0b" opacity="0.8"/>
    </marker>
  </defs>`;

  // ── Background label strips ─────────────────────────────────────────
  layers.forEach((layer, li) => {
    const x     = layerX[li];
    const ys    = layerYs[li];
    const minY  = Math.min(...ys) - R - 8;
    const maxY  = Math.max(...ys) + R + 8;
    const bgColor = li === 0 ? '#eff6ff' : li === layers.length-1 ? '#f5f3ff' : '#f0fdf4';
    svg += `<rect x="${x - R - 12}" y="${minY}" width="${R * 2 + 24}"
      height="${maxY - minY}" rx="14" fill="${bgColor}" opacity="0.6"/>`;
  });

  // ── Connections (thin lines between layers) ─────────────────────────
  layers.forEach((layer, li) => {
    if (li >= layers.length - 1) return;
    const nextLayer = layers[li + 1];
    const x1 = layerX[li] + R;
    const x2 = layerX[li + 1] - R;
    const ys1 = layerYs[li];
    const ys2 = layerYs[li + 1];

    ys1.forEach(y1 => {
      ys2.forEach(y2 => {
        svg += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"
          stroke="#e2e8f0" stroke-width="0.8" opacity="0.7"/>`;
      });
    });
    // Extra faded lines for ellipsis layers
    if (layer.n > layer.showN) {
      svg += `<line x1="${x1}" y1="${Math.max(...ys1)}" x2="${x2}" y2="${layerYs[li+1][0]}"
        stroke="#e2e8f0" stroke-width="0.4" opacity="0.3" stroke-dasharray="3,3"/>`;
    }
  });

  // ── Nodes ───────────────────────────────────────────────────────────
  layers.forEach((layer, li) => {
    const x  = layerX[li];
    const ys = layerYs[li];

    ys.forEach((y, ni) => {
      const name = layer.names ? layer.names[ni] : null;
      // Outer glow ring
      svg += `<circle cx="${x}" cy="${y}" r="${R + 4}" fill="${layer.color}" opacity="0.12"/>`;
      // Main node
      svg += `<circle cx="${x}" cy="${y}" r="${R}" fill="${layer.color}" opacity="0.92"/>`;
      // Label inside node
      if (name) {
        const fontSize = name.length > 5 ? 7.5 : 8.5;
        svg += `<text x="${x}" y="${y + 3}" text-anchor="middle"
          font-size="${fontSize}" font-weight="700" fill="white">${name}</text>`;
      } else {
        svg += `<circle cx="${x}" cy="${y}" r="4" fill="white" opacity="0.7"/>`;
      }
    });

    // Ellipsis dots if hidden layer has more nodes
    if (layer.n > layer.showN) {
      const lastY = Math.max(...ys);
      const ellipsY = lastY + R + GAP + 12;
      svg += `<text x="${x}" y="${ellipsY}" text-anchor="middle"
        font-size="14" fill="${layer.color}" opacity="0.6" letter-spacing="2">···</text>`;
      svg += `<text x="${x}" y="${ellipsY + 14}" text-anchor="middle"
        font-size="8" fill="#94a3b8">${layer.n} neuron</text>`;
    }
  });

  // ── Layer labels at bottom ──────────────────────────────────────────
  layers.forEach((layer, li) => {
    const x = layerX[li];
    svg += `<text x="${x}" y="${H - 26}" text-anchor="middle"
      font-size="9.5" font-weight="700" fill="#374151">${layer.label}</text>`;
    svg += `<text x="${x}" y="${H - 13}" text-anchor="middle"
      font-size="8" fill="#6b7280">${layer.sub}</text>`;
  });

  // ── Forward propagation label (top center) ──────────────────────────
  const midX = (layerX[0] + layerX[4]) / 2;
  svg += `<text x="${midX}" y="16" text-anchor="middle"
    font-size="9" fill="#94a3b8" letter-spacing="1">── Forward Propagation ──▶</text>`;

  // ── Backpropagation curved arrow (bottom) ───────────────────────────
  const bpY    = H - 3;
  const bpX1   = layerX[4] + R - 5;
  const bpX2   = layerX[0] - R + 5;
  const bpCurY = H + 18;
  svg += `<path d="M ${bpX1} ${bpY} Q ${midX} ${bpCurY} ${bpX2} ${bpY}"
    fill="none" stroke="#f59e0b" stroke-width="1.8" stroke-dasharray="6,3"
    marker-end="url(#arrowBack)" opacity="0.75"/>`;

  svg += '</svg>';
  el.innerHTML = svg;
}

window.renderANNDiagram = renderANNDiagram;

export default function LeadershipSnapshotServer({
  profile,
  emissions,
  scope3,
}: {
  profile: any;
  emissions: any[];
  scope3: any[];
}) {
  // ----- SIMPLE STATIC CALCULATIONS -----
  const total = emissions?.reduce((s, e) => s + (e.total_co2e ?? 0), 0) || 0;
  const totalTonnes = (total / 1000).toFixed(2);

  const last = emissions?.[emissions.length - 1];
  const lastT = last ? (last.total_co2e / 1000).toFixed(2) : '0.00';

  // Basic example trend
  const trendValues =
    emissions?.slice(-6).map((e) => e.total_co2e / 1000) || [];

  // Build trend chart placeholders (simple bars)
  const bars = trendValues
    .map((v) => {
      const h = Math.max(5, Math.min(100, v * 8));
      return `<div style="width:20px;height:${h}px;background:#3E6AE1;border-radius:3px"></div>`;
    })
    .join('');

  // ---- HTML OUTPUT (A4 layout using simple CSS) ----
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>Leadership Snapshot</title>
  <style>
    body {
      font-family: Inter, sans-serif;
      padding: 32px;
      background: #F4F7FB;
    }
    h1, h2, h3 { margin: 0; padding: 0; }
    .card {
      background: white;
      padding: 20px;
      border-radius: 12px;
      margin-bottom: 24px;
      box-shadow: 0 1px 4px rgba(0,0,0,0.1);
    }
    .row { display: flex; gap: 20px; }
    .col { flex: 1; }
    table {
      width: 100%;
      font-size: 12px;
      border-collapse: collapse;
    }
    th {
      text-align: left;
      border-bottom: 1px solid #DDD;
      padding: 6px 0;
    }
    td { padding: 4px 0; }
  </style>
</head>
<body>

  <h2 style="color:#64748B;letter-spacing:2px;margin-bottom:20px;">
    LEADERSHIP SNAPSHOT
  </h2>

  <!-- TOP ROW -->
  <div class="row">
    <div class="card col">
      <h3 style="font-size:13px;margin-bottom:8px;">Total emissions</h3>
      <p style="font-size:32px;font-weight:bold;">${totalTonnes} t CO₂e</p>
      <p style="font-size:12px;color:#475569;">Across all reported months.</p>
    </div>

    <div class="card col">
      <h3 style="font-size:13px;margin-bottom:8px;">Last reported month</h3>
      <p style="font-size:28px;font-weight:600;">${lastT} t CO₂e</p>
      <p style="font-size:12px;color:#475569;">
        ${last?.month ?? 'N/A'}
      </p>
    </div>
  </div>

  <!-- TREND -->
  <div class="card">
    <h3 style="font-size:13px;margin-bottom:12px;">6-Month Emissions Trend</h3>
    <div style="display:flex;align-items:flex-end;gap:6px;height:120px;">
      ${bars}
    </div>
  </div>

  <!-- RECENT TABLE -->
  <div class="card">
    <h3 style="font-size:13px;margin-bottom:12px;">Recent Activity</h3>

    <table>
      <thead>
        <tr>
          <th>Month</th>
          <th>Electricity</th>
          <th>Fuel</th>
          <th>Refrigerant</th>
          <th>Total CO₂e</th>
        </tr>
      </thead>
      <tbody>
        ${emissions
          ?.slice(-5)
          .map(
            (e) => `
          <tr>
            <td>${e.month}</td>
            <td>${e.electricity_kw ?? 0}</td>
            <td>${e.diesel_litres ?? 0}</td>
            <td>${e.refrigerant_kg ?? 0}</td>
            <td>${(e.total_co2e / 1000).toFixed(2)} t</td>
          </tr>`
          )
          .join('')}
      </tbody>
    </table>
  </div>

</body>
</html>
`;
}

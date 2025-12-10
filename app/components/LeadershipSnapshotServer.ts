// app/components/LeadershipSnapshotServer.tsx
// This is a SERVER COMPONENT. No "use client".

type Row = {
  month: string;
  electricity: number;
  fuel: number;
  refrigerant: number;
  total_co2e: number;
};

export default function LeadershipSnapshotServer({
  emissions,
  scope3,
}: {
  emissions: any[];
  scope3: any[];
}) {
  // ---- Example Values ----
  const totalCO2 = 13.85;
  const latestCO2 = 0.04;
  const changePct = -85.2;

  return `
  <html>
    <head>
      <style>
        body {
          font-family: Arial, sans-serif;
          padding: 24px;
          background: #F5F7FA;
        }
        h1, h2, h3 {
          color: #1E293B;
        }
        .box {
          background: white;
          padding: 16px;
          border-radius: 12px;
          margin-bottom: 16px;
          border: 1px solid #E2E8F0;
        }
      </style>
    </head>
    <body>
      <h2>LEADERSHIP SNAPSHOT</h2>

      <div class="box">
        <h3>Total emissions</h3>
        <p><strong>${totalCO2}</strong> t CO₂e</p>
        <p>Last month: <strong>${latestCO2}</strong> t CO₂e</p>
        <p>Change: ${changePct}%</p>
      </div>

      <div class="box">
        <h3>Recent Activity</h3>
        <p>(Example — replace later with real rows)</p>
      </div>
    </body>
  </html>
  `;
}

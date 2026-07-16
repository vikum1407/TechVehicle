import * as Print from 'expo-print'
import * as Sharing from 'expo-sharing'

type Vehicle = {
  registrationNo: string
  make: string
  model: string
  year: number
  fuelType: string
  mileage: number
}

type ServiceRecord = {
  id: string
  date: string
  description: string
  mileage: number | null
  parts: string | null
  brand: string | null
  cost: number | null
  notes: string | null
}

type FuelLog = {
  id: string
  date: string
  mileage: number
  litres: number | null
  cost: number | null
  fullTank: boolean
  station: string | null
}

type Expense = {
  id: string
  date: string
  category: string
  amount: number
  description: string | null
}

function fmt(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function lkr(n: number | null | undefined) {
  if (n == null) return '—'
  return `LKR ${n.toLocaleString()}`
}

function buildHtml(
  vehicle: Vehicle,
  records: ServiceRecord[],
  fuelLogs: FuelLog[],
  expenses: Expense[]
): string {
  const generatedOn = new Date().toLocaleDateString('en-GB', {
    day: '2-digit', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })

  const totalServiceCost = records.reduce((s, r) => s + (r.cost ?? 0), 0)
  const totalFuelCost    = fuelLogs.reduce((s, f) => s + (f.cost ?? 0), 0)
  const totalExpenses    = expenses.reduce((s, e) => s + e.amount, 0)
  const grandTotal       = totalServiceCost + totalFuelCost + totalExpenses

  // ── Service records rows ───────────────────────────────────────────
  const serviceRows = records.length === 0
    ? '<tr><td colspan="5" style="text-align:center;color:#aaa;padding:20px;">No service records</td></tr>'
    : records.map(r => {
        const services = r.description.split(',').map(s => s.trim()).filter(Boolean)
        const tagHtml  = services.map(s => `<span style="display:inline-block;background:#e7edf3;color:#1d3a5f;border-radius:4px;padding:2px 8px;margin:2px 2px 2px 0;font-size:11px;">${s}</span>`).join('')
        const partLine = [r.parts && `<b>Parts:</b> ${r.parts}`, r.brand && `<b>Brand:</b> ${r.brand}`].filter(Boolean).join(' &nbsp;·&nbsp; ')
        const noteLine = r.notes ? `<div style="color:#888;font-size:11px;margin-top:4px;font-style:italic;">${r.notes}</div>` : ''
        return `
        <tr>
          <td style="white-space:nowrap;color:#555;font-size:12px;">${fmt(r.date)}</td>
          <td>
            <div>${tagHtml}</div>
            ${partLine ? `<div style="font-size:11px;color:#555;margin-top:4px;">${partLine}</div>` : ''}
            ${noteLine}
          </td>
          <td style="text-align:right;white-space:nowrap;color:#555;font-size:12px;">${r.mileage != null ? r.mileage.toLocaleString() + ' km' : '—'}</td>
          <td style="text-align:right;white-space:nowrap;font-weight:600;color:#1d3a5f;font-size:12px;">${lkr(r.cost)}</td>
        </tr>`
      }).join('')

  // ── Fuel log rows (most recent 30) ────────────────────────────────
  const recentFuel = fuelLogs.slice(0, 30)
  const fuelRows = recentFuel.length === 0
    ? '<tr><td colspan="5" style="text-align:center;color:#aaa;padding:20px;">No fuel logs</td></tr>'
    : recentFuel.map(f => {
        const kmPerL = (f.litres && f.litres > 0 && f.mileage)
          ? null  // km/L needs two consecutive fill-ups — handled in analytics
          : null
        return `
        <tr>
          <td style="white-space:nowrap;color:#555;font-size:12px;">${fmt(f.date)}</td>
          <td style="text-align:right;color:#555;font-size:12px;">${f.mileage.toLocaleString()} km</td>
          <td style="text-align:right;color:#555;font-size:12px;">${f.litres != null ? f.litres.toFixed(1) + ' L' : '—'}</td>
          <td style="text-align:right;font-weight:600;color:#34a853;font-size:12px;">${lkr(f.cost)}</td>
          <td style="text-align:right;color:#555;font-size:12px;">${f.station || '—'}</td>
        </tr>`
      }).join('')

  // ── Expense rows ───────────────────────────────────────────────────
  const expenseRows = expenses.length === 0
    ? '<tr><td colspan="4" style="text-align:center;color:#aaa;padding:20px;">No expenses recorded</td></tr>'
    : expenses.map(e => `
        <tr>
          <td style="white-space:nowrap;color:#555;font-size:12px;">${fmt(e.date)}</td>
          <td><span style="display:inline-block;background:#fce4ec;color:#c62828;border-radius:4px;padding:2px 8px;font-size:11px;">${e.category}</span></td>
          <td style="color:#555;font-size:12px;">${e.description || '—'}</td>
          <td style="text-align:right;font-weight:600;color:#c62828;font-size:12px;">${lkr(e.amount)}</td>
        </tr>`
      ).join('')

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, Arial, sans-serif; font-size: 13px; color: #1a1a1a; background: #fff; padding: 24px; }
    .brand { color: #1d3a5f; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px; }
    .vehicle-header { background: linear-gradient(135deg, #1d3a5f 0%, #14293f 100%); color: #fff; border-radius: 12px; padding: 20px 24px; margin-bottom: 24px; }
    .vehicle-header h1 { font-size: 28px; font-weight: 800; letter-spacing: 2px; margin-bottom: 6px; }
    .vehicle-header .sub { font-size: 14px; opacity: 0.85; margin-bottom: 4px; }
    .vehicle-header .mileage { font-size: 20px; font-weight: 700; margin-top: 10px; }
    .vehicle-header .gen-date { font-size: 11px; opacity: 0.65; margin-top: 6px; }
    .section { margin-bottom: 28px; }
    .section h2 { font-size: 14px; font-weight: 700; color: #1a1a1a; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #e7edf3; padding-bottom: 6px; margin-bottom: 12px; }
    table { width: 100%; border-collapse: collapse; }
    th { text-align: left; font-size: 11px; font-weight: 700; color: #888; padding: 8px 10px; background: #f9f9f9; border-bottom: 1px solid #e8e8e8; text-transform: uppercase; letter-spacing: 0.4px; }
    td { padding: 10px; border-bottom: 1px solid #f0f0f0; vertical-align: top; }
    tr:last-child td { border-bottom: none; }
    .totals { background: #f9f9f9; border-radius: 10px; padding: 16px 20px; display: flex; flex-direction: column; gap: 8px; }
    .total-row { display: flex; justify-content: space-between; align-items: center; font-size: 13px; }
    .total-row.grand { font-size: 16px; font-weight: 800; color: #1d3a5f; border-top: 2px solid #e0e0e0; padding-top: 10px; margin-top: 4px; }
    .footer { text-align: center; font-size: 10px; color: #aaa; margin-top: 32px; padding-top: 12px; border-top: 1px solid #eee; }
  </style>
</head>
<body>
  <div class="brand">TechVehicle — Vehicle History Report</div>

  <div class="vehicle-header">
    <h1>${vehicle.registrationNo}</h1>
    <div class="sub">${vehicle.year} ${vehicle.make} ${vehicle.model}</div>
    <div class="sub">${vehicle.fuelType}</div>
    <div class="mileage">${vehicle.mileage.toLocaleString()} km</div>
    <div class="gen-date">Generated ${generatedOn}</div>
  </div>

  <!-- ── Totals summary ──────────────────────────────────────── -->
  <div class="section">
    <h2>Cost Summary</h2>
    <div class="totals">
      <div class="total-row">
        <span>🔧 Total Service Cost</span>
        <span style="font-weight:600;">${lkr(totalServiceCost)}</span>
      </div>
      <div class="total-row">
        <span>⛽ Total Fuel Cost</span>
        <span style="font-weight:600;">${lkr(totalFuelCost)}</span>
      </div>
      <div class="total-row">
        <span>💰 Total Other Expenses</span>
        <span style="font-weight:600;">${lkr(totalExpenses)}</span>
      </div>
      <div class="total-row grand">
        <span>Grand Total</span>
        <span>${lkr(grandTotal)}</span>
      </div>
    </div>
  </div>

  <!-- ── Service records ────────────────────────────────────── -->
  <div class="section">
    <h2>Service History (${records.length} records)</h2>
    <table>
      <thead>
        <tr>
          <th>Date</th>
          <th>Work Done</th>
          <th style="text-align:right;">Mileage</th>
          <th style="text-align:right;">Cost</th>
        </tr>
      </thead>
      <tbody>${serviceRows}</tbody>
    </table>
  </div>

  <!-- ── Fuel log ───────────────────────────────────────────── -->
  <div class="section">
    <h2>Fuel Log${fuelLogs.length > 30 ? ' (latest 30 of ' + fuelLogs.length + ')' : ' (' + fuelLogs.length + ' entries)'}</h2>
    <table>
      <thead>
        <tr>
          <th>Date</th>
          <th style="text-align:right;">Odometer</th>
          <th style="text-align:right;">Litres</th>
          <th style="text-align:right;">Cost</th>
          <th style="text-align:right;">Station</th>
        </tr>
      </thead>
      <tbody>${fuelRows}</tbody>
    </table>
  </div>

  <!-- ── Expenses ───────────────────────────────────────────── -->
  <div class="section">
    <h2>Other Expenses (${expenses.length} entries)</h2>
    <table>
      <thead>
        <tr>
          <th>Date</th>
          <th>Category</th>
          <th>Description</th>
          <th style="text-align:right;">Amount</th>
        </tr>
      </thead>
      <tbody>${expenseRows}</tbody>
    </table>
  </div>

  <div class="footer">
    TechVehicle · Verified Vehicle History · ${vehicle.registrationNo} · ${generatedOn}
  </div>
</body>
</html>`
}

export async function exportVehiclePdf(
  vehicle: Vehicle,
  records: ServiceRecord[],
  fuelLogs: FuelLog[],
  expenses: Expense[]
): Promise<void> {
  const html = buildHtml(vehicle, records, fuelLogs, expenses)
  const { uri } = await Print.printToFileAsync({ html })
  await Sharing.shareAsync(uri, {
    mimeType: 'application/pdf',
    dialogTitle: `${vehicle.registrationNo} — Service History`,
    UTI: 'com.adobe.pdf',
  })
}

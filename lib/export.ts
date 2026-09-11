// Export / backup helpers. Browser-compatible file generation with
// optional Android Web Share support.

import type { Ticket, DailySettings } from './types'
import { getTickets, getSettings, getBackups } from './storage'

const CSV_HEADER = [
  'Date',
  'Time',
  'Ticket No',
  'Truck No',
  'Gross',
  'Tare',
  'Net',
  'Cumul',
  'Shift',
  'DUM',
  'Navire',
  'Produit',
  'Client',
]

function csvEscape(value: string | number): string {
  const s = String(value ?? '')
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

export function buildCsv(tickets: Ticket[], settings: DailySettings): string {
  const rows = tickets.map((t) =>
    [
      t.date,
      t.time,
      t.ticketNo,
      t.truckNo,
      t.gross,
      t.tare,
      t.net,
      t.cumul,
      t.shift,
      settings.dum,
      settings.navire,
      settings.produit,
      settings.client,
    ]
      .map(csvEscape)
      .join(','),
  )
  return [CSV_HEADER.join(','), ...rows].join('\n')
}

export function csvFilename(date: string): string {
  return `River_${date}.csv`
}

export function buildBackupJson(): string {
  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      tickets: getTickets(),
      settings: getSettings(),
      backups: getBackups(),
    },
    null,
    2,
  )
}

// Trigger a browser download for text content.
export function downloadFile(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// Share via the Web Share API (Android) when possible, else fall back to download.
export async function shareOrDownload(
  filename: string,
  content: string,
  mime: string,
): Promise<'shared' | 'downloaded'> {
  const nav = typeof navigator !== 'undefined' ? navigator : undefined
  try {
    if (nav && 'canShare' in nav && typeof File !== 'undefined') {
      const file = new File([content], filename, { type: mime })
      // @ts-expect-error canShare with files is not in all TS lib versions
      if (nav.canShare({ files: [file] })) {
        // @ts-expect-error share with files is not in all TS lib versions
        await nav.share({ files: [file], title: filename })
        return 'shared'
      }
    }
  } catch {
    // fall through to download
  }
  downloadFile(filename, content, mime)
  return 'downloaded'
}

// ---- Printable PDF report (Arabic RTL) ----
// We build a self-contained RTL HTML document and let the browser's
// "Print → Save as PDF" produce a clean, organized Arabic PDF.

function htmlEscape(value: string | number | undefined): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export interface ReportTotals {
  count: number
  totalGross: number
  totalTare: number
  totalNet: number
  previousTotal: number
  globalTotal: number
}

const SHIFT_LABELS: Record<number, string> = {
  1: 'الوردية 1',
  2: 'الوردية 2',
  3: 'الوردية 3',
}

export function buildReportHtml(
  date: string,
  tickets: Ticket[],
  settings: DailySettings,
  totals: ReportTotals,
): string {
  const rows = tickets
    .map(
      (t, i) => `
        <tr>
          <td>${i + 1}</td>
          <td>${htmlEscape(t.ticketNo)}</td>
          <td>${htmlEscape(t.truckNo)}</td>
          <td>${htmlEscape(t.client)}</td>
          <td>${htmlEscape(t.permit)}</td>
          <td class="num">${htmlEscape(t.gross)}</td>
          <td class="num">${htmlEscape(t.tare)}</td>
          <td class="num strong">${htmlEscape(t.net)}</td>
          <td class="num">${htmlEscape(t.cumul)}</td>
          <td>${htmlEscape(SHIFT_LABELS[t.shift] ?? t.shift)}</td>
          <td>${htmlEscape(t.dum)}</td>
          <td>${htmlEscape(t.time)}</td>
        </tr>`,
    )
    .join('')

  const emptyRow = `<tr><td colspan="12" class="empty">لا توجد تذاكر لهذا اليوم</td></tr>`

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>تقرير River Trucks - ${htmlEscape(date)}</title>
<style>
  * { box-sizing: border-box; }
  body {
    font-family: -apple-system, "Segoe UI", "Noto Naskh Arabic", "Arial", sans-serif;
    color: #111827; margin: 24px; direction: rtl;
  }
  h1 { font-size: 22px; margin: 0 0 4px; }
  .sub { color: #6b7280; font-size: 13px; margin-bottom: 16px; }
  .meta { display: flex; flex-wrap: wrap; gap: 8px 24px; margin-bottom: 16px; font-size: 13px; }
  .meta span b { color: #374151; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th, td { border: 1px solid #d1d5db; padding: 6px 8px; text-align: right; }
  th { background: #1e3a5f; color: #fff; font-weight: 700; }
  td.num { text-align: left; font-variant-numeric: tabular-nums; }
  td.strong { font-weight: 700; }
  td.empty { text-align: center; color: #6b7280; padding: 24px; }
  tbody tr:nth-child(even) { background: #f9fafb; }
  .totals { margin-top: 18px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
  .card { border: 1px solid #d1d5db; border-radius: 8px; padding: 10px 12px; }
  .card .label { font-size: 12px; color: #6b7280; }
  .card .value { font-size: 18px; font-weight: 700; margin-top: 2px; }
  .global { grid-column: 1 / -1; background: #1e3a5f; color: #fff; border-color: #1e3a5f; }
  .global .label { color: #cbd5e1; }
  .foot { margin-top: 20px; font-size: 11px; color: #9ca3af; }
  @media print { body { margin: 12mm; } }
</style>
</head>
<body>
  <h1>تقرير River Trucks</h1>
  <div class="sub">تسجيل تذاكر الشاحنات وحساب الأوزان</div>
  <div class="meta">
    <span><b>التاريخ:</b> ${htmlEscape(date)}</span>
    <span><b>Navire:</b> ${htmlEscape(settings.navire) || '—'}</span>
    <span><b>Produit:</b> ${htmlEscape(settings.produit) || '—'}</span>
    <span><b>Client:</b> ${htmlEscape(settings.client) || '—'}</span>
  </div>
  <table>
    <thead>
      <tr>
        <th>#</th><th>التذكرة</th><th>الشاحنة</th><th>الزبون</th><th>التصريح</th>
        <th>Brut</th><th>Tare</th><th>Net</th><th>Cumul</th><th>الوردية</th><th>DUM</th><th>الوقت</th>
      </tr>
    </thead>
    <tbody>${rows || emptyRow}</tbody>
  </table>
  <div class="totals">
    <div class="card"><div class="label">عدد التذاكر</div><div class="value">${totals.count}</div></div>
    <div class="card"><div class="label">مجموع Brut</div><div class="value">${totals.totalGross}</div></div>
    <div class="card"><div class="label">مجموع Tare</div><div class="value">${totals.totalTare}</div></div>
    <div class="card"><div class="label">مجموع Net</div><div class="value">${totals.totalNet}</div></div>
    <div class="card"><div class="label">T. Antérieur</div><div class="value">${totals.previousTotal}</div></div>
    <div class="card"><div class="label">Cumul (اليوم)</div><div class="value">${totals.totalNet}</div></div>
    <div class="card global"><div class="label">Total Global</div><div class="value">${totals.globalTotal}</div></div>
  </div>
  <div class="foot">تم الإنشاء في ${htmlEscape(new Date().toLocaleString('ar'))}</div>
</body>
</html>`
}

// Open the report in a new window and trigger the print dialog so the user
// can "Save as PDF". Falls back to same-tab document write inside an iframe
// when popups are blocked.
export function printReport(html: string): void {
  const win = window.open('', '_blank')
  if (win) {
    win.document.open()
    win.document.write(html)
    win.document.close()
    win.focus()
    // Give the browser a moment to render fonts/layout before printing.
    setTimeout(() => win.print(), 400)
    return
  }

  // Popup blocked: use a hidden iframe in the current document.
  const iframe = document.createElement('iframe')
  iframe.style.position = 'fixed'
  iframe.style.right = '0'
  iframe.style.bottom = '0'
  iframe.style.width = '0'
  iframe.style.height = '0'
  iframe.style.border = '0'
  document.body.appendChild(iframe)
  const doc = iframe.contentWindow?.document
  if (doc) {
    doc.open()
    doc.write(html)
    doc.close()
    setTimeout(() => {
      iframe.contentWindow?.focus()
      iframe.contentWindow?.print()
      setTimeout(() => document.body.removeChild(iframe), 1000)
    }, 400)
  }
}

export interface ParsedBackup {
  tickets?: Ticket[]
  settings?: DailySettings
}

export function parseBackupJson(text: string): ParsedBackup {
  const data = JSON.parse(text)
  return { tickets: data.tickets, settings: data.settings }
}

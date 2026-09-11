'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Header } from '@/components/Header'
import { Toast, type ToastState } from '@/components/Toast'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import {
  getTodayTickets,
  getSettings,
  getActiveDate,
  setActiveDate,
  resetActiveDate,
  isDayClosed,
  saveDailyBackup,
  reopenDay,
  getClosedDays,
  getPreviousDayTotal,
  todayString,
} from '@/lib/storage'
import { calculateDailyStats, calculateGlobalTotal } from '@/lib/calculations'
import {
  buildReportHtml,
  printReport,
  buildBackupJson,
  downloadFile,
  type ReportTotals,
} from '@/lib/export'
import type { Ticket, DailySettings } from '@/lib/types'

function ExportView() {
  const router = useRouter()
  const params = useSearchParams()
  const wantEndDay = params.get('endDay') === '1'

  const [activeDate, setActiveDateState] = useState('')
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [settings, setSettings] = useState<DailySettings | null>(null)
  const [closed, setClosed] = useState(false)
  const [closedDays, setClosedDays] = useState<string[]>([])
  const [confirmEndDay, setConfirmEndDay] = useState(false)
  const [resumeDate, setResumeDate] = useState<string | null>(null)
  const [toast, setToast] = useState<ToastState | null>(null)

  function refresh() {
    const date = getActiveDate()
    setActiveDateState(date)
    setTickets(getTodayTickets(date))
    setSettings(getSettings())
    setClosed(isDayClosed(date))
    setClosedDays(getClosedDays())
  }

  useEffect(() => {
    refresh()
    if (wantEndDay) setConfirmEndDay(true)
  }, [wantEndDay])

  const stats = calculateDailyStats(tickets)
  const previousTotal = settings ? getPreviousDayTotal(settings, activeDate) : 0
  const globalTotal = calculateGlobalTotal(previousTotal, stats.totalNet)
  const isToday = activeDate === todayString()

  function totals(): ReportTotals {
    return {
      count: stats.count,
      totalGross: stats.totalGross,
      totalTare: stats.totalTare,
      totalNet: stats.totalNet,
      previousTotal,
      globalTotal,
    }
  }

  function handleExportPdf() {
    if (!settings) return
    const html = buildReportHtml(activeDate, tickets, settings, totals())
    printReport(html)
    setToast({ kind: 'info', message: 'اختر "حفظ كـ PDF" من نافذة الطباعة.' })
  }

  function handleBackupJson() {
    downloadFile(`River_backup_${activeDate}.json`, buildBackupJson(), 'application/json')
    setToast({ kind: 'success', message: 'تم تنزيل نسخة احتياطية (JSON).' })
  }

  // End day: save a backup snapshot and mark closed. Data is NOT deleted.
  function confirmEnd() {
    if (!settings) return
    saveDailyBackup({
      date: activeDate,
      settings,
      tickets,
      totalNet: stats.totalNet,
      closed: true,
      savedAt: new Date().toISOString(),
    })
    setConfirmEndDay(false)
    // After closing a reopened past day, return the active day to today.
    if (!isToday) resetActiveDate()
    setToast({ kind: 'success', message: 'تم إنهاء اليوم وحفظ البيانات بنجاح.' })
    setTimeout(() => router.push('/'), 900)
  }

  function confirmResume() {
    if (!resumeDate) return
    reopenDay(resumeDate)
    setResumeDate(null)
    refresh()
    setToast({ kind: 'success', message: `تم فتح يوم ${resumeDate} لمتابعة الإدخال.` })
  }

  function backToToday() {
    resetActiveDate()
    refresh()
    setToast({ kind: 'info', message: 'تمت العودة إلى يوم اليوم.' })
  }

  const statItems = [
    { label: 'عدد التذاكر', value: stats.count },
    { label: 'مجموع Net', value: stats.totalNet, accent: true },
    { label: 'T. Antérieur', value: previousTotal },
    { label: 'Total Global', value: globalTotal },
  ]

  return (
    <main className="min-h-dvh bg-background pb-10">
      <Header title="📤 التصدير والحفظ" subtitle="تصدير PDF وإنهاء اليوم" backHref="/" />
      <Toast toast={toast} onDismiss={() => setToast(null)} />

      <div className="mx-auto flex max-w-md flex-col gap-5 px-4 py-6">
        {!isToday ? (
          <div className="flex flex-col gap-2 rounded-2xl border-2 border-camera/40 bg-camera/10 p-4">
            <p className="font-bold text-card-foreground">
              أنت تعمل الآن على يوم سابق: {activeDate}
            </p>
            <button
              type="button"
              onClick={backToToday}
              className="w-full rounded-2xl border border-border bg-card px-4 py-3 font-bold text-card-foreground active:scale-[0.98]"
            >
              العودة إلى اليوم الحالي
            </button>
          </div>
        ) : null}

        {closed ? (
          <p className="rounded-2xl bg-reports/10 px-4 py-3 text-center font-bold text-reports">
            هذا اليوم ({activeDate}) منتهٍ ومحفوظ. يمكنك تصديره أو إعادة فتحه للمتابعة.
          </p>
        ) : null}

        {/* Summary */}
        <div className="grid grid-cols-2 gap-3">
          {statItems.map((item) => (
            <div key={item.label} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <p className="text-sm text-muted-foreground">{item.label}</p>
              <p
                className={`mt-1 text-2xl font-extrabold tabular-nums ${
                  item.accent ? 'text-manual' : 'text-card-foreground'
                }`}
              >
                {item.value}
              </p>
            </div>
          ))}
        </div>

        {/* Export actions */}
        <section className="flex flex-col gap-3">
          <h2 className="px-1 text-lg font-extrabold text-foreground">تصدير البيانات</h2>
          <button
            type="button"
            onClick={handleExportPdf}
            className="w-full rounded-2xl bg-export px-4 py-4 text-lg font-bold text-export-foreground shadow-sm active:scale-[0.98]"
          >
            🧾 تصدير PDF (عربي منظم)
          </button>
          <button
            type="button"
            onClick={handleBackupJson}
            className="w-full rounded-2xl border border-border bg-card px-4 py-4 text-lg font-bold text-card-foreground active:scale-[0.98]"
          >
            💾 نسخة احتياطية (JSON)
          </button>
        </section>

        {/* End day */}
        <section className="flex flex-col gap-3">
          <h2 className="px-1 text-lg font-extrabold text-foreground">إنهاء اليوم</h2>
          <button
            type="button"
            onClick={() => setConfirmEndDay(true)}
            disabled={closed}
            className="w-full rounded-2xl bg-danger px-4 py-4 text-lg font-bold text-danger-foreground shadow-sm active:scale-[0.98] disabled:opacity-50"
          >
            🏁 إنهاء اليوم وحفظ البيانات
          </button>
          <p className="px-1 text-sm text-muted-foreground">
            لن يتم حذف أي بيانات. سيتم حفظ نسخة من اليوم وإغلاقه فقط.
          </p>
        </section>

        {/* Resume previous work */}
        {closedDays.length > 0 ? (
          <section className="flex flex-col gap-3">
            <h2 className="px-1 text-lg font-extrabold text-foreground">إكمال عمل سابق</h2>
            <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4 shadow-sm">
              {closedDays.map((d) => (
                <div key={d} className="flex items-center justify-between gap-2">
                  <span className="font-bold tabular-nums text-card-foreground">{d}</span>
                  <button
                    type="button"
                    onClick={() => setResumeDate(d)}
                    className="rounded-xl bg-manual/10 px-4 py-2 text-sm font-bold text-manual active:scale-[0.98]"
                  >
                    إعادة الفتح والمتابعة
                  </button>
                </div>
              ))}
            </div>
          </section>
        ) : null}
      </div>

      <ConfirmDialog
        open={confirmEndDay}
        title="تأكيد إنهاء اليوم"
        message={`سيتم حفظ بيانات يوم ${activeDate} (${stats.count} تذكرة، مجموع Net ${stats.totalNet}) وإغلاق اليوم. البيانات تبقى محفوظة ولن تُحذف. هل تريد المتابعة؟`}
        confirmLabel="نعم، إنهاء اليوم"
        cancelLabel="تراجع"
        onConfirm={confirmEnd}
        onCancel={() => setConfirmEndDay(false)}
      />

      <ConfirmDialog
        open={resumeDate !== null}
        title="إكمال عمل سابق"
        message={
          resumeDate
            ? `سيتم إعادة فتح يوم ${resumeDate} لتتمكن من إضافة أو تعديل تذاكره. هل تريد المتابعة؟`
            : ''
        }
        confirmLabel="فتح ومتابعة"
        cancelLabel="إلغاء"
        onConfirm={confirmResume}
        onCancel={() => setResumeDate(null)}
      />
    </main>
  )
}

export default function ExportPage() {
  return (
    <Suspense fallback={null}>
      <ExportView />
    </Suspense>
  )
}

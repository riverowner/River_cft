'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Header } from '@/components/Header'
import { Toast, type ToastState } from '@/components/Toast'
import { runOcr, type OcrResult } from '@/lib/ocr'

const OCR_PREFILL_KEY = 'riverTrucks_ocrPrefill'

type Status = 'idle' | 'processing' | 'done' | 'error'

export default function CapturePage() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [status, setStatus] = useState<Status>('idle')
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState<OcrResult | null>(null)
  const [toast, setToast] = useState<ToastState | null>(null)

  async function handleFile(file: File) {
    setStatus('processing')
    setProgress(0)
    setResult(null)

    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(URL.createObjectURL(file))

    try {
      const ocr = await runOcr(file, (p) => setProgress(p))
      setResult(ocr)
      setStatus('done')
      const hasAny =
        ocr.ticketNo || ocr.truckNo || ocr.gross !== undefined || ocr.tare !== undefined
      setToast(
        hasAny
          ? { kind: 'success', message: 'تمت قراءة الصورة. راجع القيم ثم تابع.' }
          : { kind: 'info', message: 'لم يتم التعرف على قيم واضحة. يمكنك الإدخال يدوياً.' },
      )
    } catch {
      setStatus('error')
      setToast({ kind: 'error', message: 'تعذّرت قراءة الصورة. جرّب صورة أوضح أو أدخل يدوياً.' })
    }
  }

  function onInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) void handleFile(file)
  }

  function proceedToForm() {
    if (result) {
      const prefill = {
        ticketNo: result.ticketNo,
        truckNo: result.truckNo,
        gross: result.gross,
        tare: result.tare,
      }
      sessionStorage.setItem(OCR_PREFILL_KEY, JSON.stringify(prefill))
    }
    router.push('/manual')
  }

  const readRows: { label: string; value: string }[] = result
    ? [
        { label: 'رقم التذكرة', value: result.ticketNo ?? '—' },
        { label: 'رقم الشاحنة', value: result.truckNo ?? '—' },
        { label: 'الوزن القائم Brut', value: result.gross !== undefined ? String(result.gross) : '—' },
        { label: 'الوزن الفارغ Tare', value: result.tare !== undefined ? String(result.tare) : '—' },
        { label: 'الوزن الصافي Net', value: result.net !== undefined ? String(result.net) : '—' },
      ]
    : []

  return (
    <main className="min-h-dvh bg-background pb-10">
      <Header
        title="📷 التقاط تذكرة بالكاميرا"
        subtitle="ميزة اختيارية تملأ النموذج تلقائياً"
        backHref="/"
      />
      <Toast toast={toast} onDismiss={() => setToast(null)} />

      <div className="mx-auto flex max-w-md flex-col gap-5 px-4 py-6">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={onInputChange}
          className="hidden"
        />

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={status === 'processing'}
          className="flex min-h-28 w-full flex-col items-center justify-center gap-2 rounded-2xl bg-camera px-5 py-6 text-xl font-bold text-camera-foreground shadow-sm active:scale-[0.98] disabled:opacity-50"
        >
          <span className="text-4xl" aria-hidden>
            📷
          </span>
          {previewUrl ? 'التقاط صورة أخرى' : 'التقاط / اختيار صورة التذكرة'}
        </button>

        {previewUrl ? (
          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            <div className="relative aspect-video w-full">
              <Image
                src={previewUrl}
                alt="معاينة صورة التذكرة"
                fill
                unoptimized
                className="object-contain"
              />
            </div>
          </div>
        ) : (
          <p className="rounded-2xl border border-dashed border-border bg-card px-4 py-8 text-center text-muted-foreground">
            وجّه الكاميرا نحو التذكرة بوضوح وإضاءة جيدة للحصول على أفضل قراءة.
          </p>
        )}

        {status === 'processing' ? (
          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <p className="mb-2 font-bold text-card-foreground">جارٍ قراءة الصورة… {progress}%</p>
            <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-camera transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        ) : null}

        {status === 'done' && result ? (
          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <h2 className="mb-3 text-lg font-extrabold text-card-foreground">القيم المقروءة</h2>
            <div className="flex flex-col gap-2">
              {readRows.map((row) => (
                <div
                  key={row.label}
                  className="flex items-center justify-between border-b border-border/60 pb-2 last:border-0 last:pb-0"
                >
                  <span className="text-sm text-muted-foreground">{row.label}</span>
                  <span className="text-lg font-bold tabular-nums text-card-foreground">
                    {row.value}
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              القيم تقديرية من الصورة، يرجى مراجعتها في النموذج قبل الحفظ.
            </p>
          </div>
        ) : null}

        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={proceedToForm}
            className="w-full rounded-2xl bg-manual px-4 py-4 text-lg font-bold text-manual-foreground shadow-sm active:scale-[0.98]"
          >
            {result ? '➡️ متابعة إلى النموذج بالقيم المقروءة' : '✏️ الإدخال اليدوي'}
          </button>
        </div>
      </div>
    </main>
  )
}

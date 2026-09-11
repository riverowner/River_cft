'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Header } from '@/components/Header'
import { TicketForm, type TicketFormValues, type TicketFormInitial } from '@/components/TicketForm'
import { Toast, type ToastState } from '@/components/Toast'
import {
  saveTicket,
  updateTicket,
  getTicketById,
  getSettings,
  getActiveDate,
  nowTimeString,
} from '@/lib/storage'
import { getCurrentShift } from '@/lib/shifts'

const OCR_PREFILL_KEY = 'riverTrucks_ocrPrefill'

function ManualEntry() {
  const router = useRouter()
  const params = useSearchParams()
  const editId = params.get('id')

  const [initial, setInitial] = useState<TicketFormInitial | undefined>(undefined)
  const [isEditing, setIsEditing] = useState(false)
  const [ready, setReady] = useState(false)
  const [defaultClient, setDefaultClient] = useState('')
  const [toast, setToast] = useState<ToastState | null>(null)
  const [formKey, setFormKey] = useState(0)

  useEffect(() => {
    setDefaultClient(getSettings().client ?? '')

    if (editId) {
      const existing = getTicketById(editId)
      if (existing) {
        setIsEditing(true)
        setInitial({
          ticketNo: existing.ticketNo,
          truckNo: existing.truckNo,
          gross: existing.gross,
          tare: existing.tare,
          shift: existing.shift,
          client: existing.client,
          permit: existing.permit,
          dum: existing.dum,
        })
      }
      setReady(true)
      return
    }

    // Optional OCR prefill left by the capture page.
    try {
      const raw = sessionStorage.getItem(OCR_PREFILL_KEY)
      if (raw) {
        const data = JSON.parse(raw) as TicketFormInitial
        setInitial(data)
        sessionStorage.removeItem(OCR_PREFILL_KEY)
        setToast({ kind: 'info', message: 'تم ملء الحقول من الصورة، يرجى المراجعة.' })
      }
    } catch {
      // ignore malformed prefill
    }
    setReady(true)
  }, [editId])

  function handleSubmit(values: TicketFormValues) {
    if (isEditing && editId) {
      updateTicket(editId, {
        ticketNo: values.ticketNo,
        truckNo: values.truckNo,
        gross: values.gross,
        tare: values.tare,
        shift: values.shift,
        client: values.client,
        permit: values.permit,
        dum: values.dum,
      })
      setToast({ kind: 'success', message: 'تم تحديث التذكرة بنجاح.' })
      setTimeout(() => router.push('/tickets'), 700)
      return
    }

    saveTicket({
      ticketNo: values.ticketNo,
      truckNo: values.truckNo,
      gross: values.gross,
      tare: values.tare,
      shift: values.shift,
      client: values.client,
      permit: values.permit,
      dum: values.dum,
      date: getActiveDate(),
      time: nowTimeString(),
    })
    setToast({ kind: 'success', message: 'تم حفظ التذكرة بنجاح.' })
    setInitial(undefined)
    setFormKey((k) => k + 1) // remount form to clear it
  }

  if (!ready) return null

  return (
    <main className="min-h-dvh bg-background pb-10">
      <Header
        title={isEditing ? 'تعديل التذكرة' : 'إدخال البيانات يدوياً'}
        subtitle="أدخل بيانات التذكرة ثم احفظها"
        backHref={isEditing ? '/tickets' : '/'}
      />
      <Toast toast={toast} onDismiss={() => setToast(null)} />
      <div className="mx-auto max-w-md px-4 py-6">
        <TicketForm
          key={formKey}
          initial={initial}
          defaultShift={getCurrentShift()}
          defaultClient={defaultClient}
          submitLabel={isEditing ? '💾 حفظ التعديلات' : '💾 حفظ التذكرة'}
          onSubmit={handleSubmit}
          onCancel={() => router.push(isEditing ? '/tickets' : '/')}
        />
      </div>
    </main>
  )
}

export default function ManualPage() {
  return (
    <Suspense fallback={null}>
      <ManualEntry />
    </Suspense>
  )
}

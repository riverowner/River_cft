'use client'

import { useEffect, useMemo, useState } from 'react'
import { calculateNet } from '@/lib/calculations'
import { getShiftLabel } from '@/lib/shifts'
import { getClients } from '@/lib/storage'
import type { Client } from '@/lib/types'

export interface TicketFormValues {
  ticketNo: string
  truckNo: string
  gross: number
  tare: number
  net: number
  shift: number
  client: string
  permit: string
  dum: string
}

export interface TicketFormInitial {
  ticketNo?: string
  truckNo?: string
  gross?: number | string
  tare?: number | string
  shift?: number
  client?: string
  permit?: string
  dum?: string
}

interface TicketFormProps {
  initial?: TicketFormInitial
  defaultShift: number
  defaultClient?: string
  submitLabel?: string
  onSubmit: (values: TicketFormValues) => void
  onCancel: () => void
}

function toStr(v: number | string | undefined): string {
  if (v === undefined || v === null) return ''
  return String(v)
}

export function TicketForm({
  initial,
  defaultShift,
  defaultClient = '',
  submitLabel = '💾 حفظ التذكرة',
  onSubmit,
  onCancel,
}: TicketFormProps) {
  const [clients, setClients] = useState<Client[]>([])
  const [ticketNo, setTicketNo] = useState(toStr(initial?.ticketNo))
  const [truckNo, setTruckNo] = useState(toStr(initial?.truckNo))
  const [gross, setGross] = useState(toStr(initial?.gross))
  const [tare, setTare] = useState(toStr(initial?.tare))
  const [shift, setShift] = useState<number>(initial?.shift ?? defaultShift)
  const [client, setClient] = useState<string>(initial?.client ?? defaultClient)
  const [permit, setPermit] = useState<string>(initial?.permit ?? '')
  const [dum, setDum] = useState<string>(initial?.dum ?? '')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setClients(getClients())
  }, [])

  // Permits available for the currently selected client.
  const permitsForClient = useMemo(() => {
    const found = clients.find((c) => c.name === client)
    return found ? found.permits : []
  }, [clients, client])

  // If the selected permit is no longer valid for the client, clear it.
  useEffect(() => {
    if (permit && !permitsForClient.includes(permit)) {
      setPermit('')
    }
  }, [permitsForClient, permit])

  const grossNum = gross.trim() === '' ? NaN : Number(gross)
  const tareNum = tare.trim() === '' ? NaN : Number(tare)

  const net = useMemo(() => {
    if (!Number.isFinite(grossNum) || !Number.isFinite(tareNum)) return null
    return calculateNet(grossNum, tareNum)
  }, [grossNum, tareNum])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (ticketNo.trim() === '') {
      setError('يرجى إدخال رقم التذكرة.')
      return
    }
    if (!Number.isFinite(grossNum) || grossNum < 0) {
      setError('يرجى إدخال وزن قائم (Brut) صحيح.')
      return
    }
    if (!Number.isFinite(tareNum) || tareNum < 0) {
      setError('يرجى إدخال وزن فارغ (Tare) صحيح.')
      return
    }
    if (tareNum > grossNum) {
      setError('الوزن الفارغ (Tare) لا يمكن أن يكون أكبر من الوزن القائم (Brut).')
      return
    }
    setError(null)
    onSubmit({
      ticketNo: ticketNo.trim(),
      truckNo: truckNo.trim(),
      gross: grossNum,
      tare: tareNum,
      net: calculateNet(grossNum, tareNum),
      shift,
      client,
      permit,
      dum: dum.trim(),
    })
  }

  const inputClass =
    'w-full rounded-2xl border border-border bg-card px-4 py-3 text-lg text-card-foreground outline-none focus:ring-2 focus:ring-ring'
  const labelClass = 'mb-1 block text-sm font-bold text-muted-foreground'

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      <div>
        <label htmlFor="ticketNo" className={labelClass}>
          رقم التذكرة
        </label>
        <input
          id="ticketNo"
          value={ticketNo}
          onChange={(e) => setTicketNo(e.target.value)}
          inputMode="numeric"
          className={inputClass}
          placeholder="مثال: 1024"
        />
      </div>

      <div>
        <label htmlFor="truckNo" className={labelClass}>
          رقم الشاحنة
        </label>
        <input
          id="truckNo"
          value={truckNo}
          onChange={(e) => setTruckNo(e.target.value)}
          className={inputClass}
          placeholder="مثال: 4521"
        />
      </div>

      {/* Client + permits: choosing a client reveals its permits clearly. */}
      <div>
        <label htmlFor="client" className={labelClass}>
          الزبون
        </label>
        <select
          id="client"
          value={client}
          onChange={(e) => setClient(e.target.value)}
          className={inputClass}
        >
          <option value="">— بدون —</option>
          {clients.map((c) => (
            <option key={c.id} value={c.name}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {client ? (
        <div>
          <span className={labelClass}>تصاريح الزبون</span>
          {permitsForClient.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">
              لا توجد تصاريح لهذا الزبون. أضِفها من صفحة الإعدادات.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {permitsForClient.map((p) => {
                const active = permit === p
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPermit(active ? '' : p)}
                    aria-pressed={active}
                    className={`rounded-full border px-4 py-2 text-base font-bold transition-colors active:scale-[0.98] ${
                      active
                        ? 'border-manual bg-manual text-manual-foreground'
                        : 'border-border bg-card text-card-foreground'
                    }`}
                  >
                    {p}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      ) : null}

      <div>
        <label htmlFor="gross" className={labelClass}>
          الوزن القائم Brut
        </label>
        <input
          id="gross"
          value={gross}
          onChange={(e) => setGross(e.target.value)}
          inputMode="decimal"
          type="number"
          min={0}
          className={inputClass}
          placeholder="0"
        />
      </div>

      <div>
        <label htmlFor="tare" className={labelClass}>
          الوزن الفارغ Tare
        </label>
        <input
          id="tare"
          value={tare}
          onChange={(e) => setTare(e.target.value)}
          inputMode="decimal"
          type="number"
          min={0}
          className={inputClass}
          placeholder="0"
        />
      </div>

      <div>
        <span className={labelClass}>الوزن الصافي Net (محسوب تلقائياً)</span>
        <div className="flex items-center justify-between rounded-2xl border-2 border-manual/30 bg-manual/10 px-4 py-3">
          <span className="text-sm text-muted-foreground">Net = Brut - Tare</span>
          <span className="text-2xl font-extrabold tabular-nums text-manual">
            {net === null ? '—' : net}
          </span>
        </div>
        {net === null ? (
          <p className="mt-1 text-sm text-muted-foreground">
            أدخل Brut و Tare لحساب الوزن الصافي.
          </p>
        ) : null}
      </div>

      <div>
        <label htmlFor="shift" className={labelClass}>
          الوردية
        </label>
        <select
          id="shift"
          value={shift}
          onChange={(e) => setShift(Number(e.target.value))}
          className={inputClass}
        >
          {[1, 2, 3].map((s) => (
            <option key={s} value={s}>
              {getShiftLabel(s)}
            </option>
          ))}
        </select>
      </div>

      {/* DUM stays optional at ticket entry only. */}
      <div>
        <label htmlFor="dum" className={labelClass}>
          DUM (اختياري)
        </label>
        <input
          id="dum"
          value={dum}
          onChange={(e) => setDum(e.target.value)}
          className={inputClass}
          placeholder="اتركه فارغاً إن لم يكن مطلوباً"
        />
      </div>

      {error ? (
        <p className="rounded-2xl bg-danger/10 px-4 py-3 font-bold text-danger" role="alert">
          {error}
        </p>
      ) : null}

      <div className="mt-2 flex flex-col gap-3">
        <button
          type="submit"
          className="w-full rounded-2xl bg-manual px-4 py-4 text-lg font-bold text-manual-foreground shadow-sm active:scale-[0.98]"
        >
          {submitLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="w-full rounded-2xl border border-border bg-card px-4 py-4 text-lg font-bold text-card-foreground active:scale-[0.98]"
        >
          إلغاء
        </button>
      </div>
    </form>
  )
}

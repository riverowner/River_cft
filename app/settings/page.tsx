'use client'

import { useEffect, useState } from 'react'
import { Header } from '@/components/Header'
import { Toast, type ToastState } from '@/components/Toast'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import {
  getSettings,
  saveSettings,
  todayString,
  getClients,
  saveClient,
  deleteClient,
  addPermit,
  removePermit,
} from '@/lib/storage'
import type { DailySettings, Client } from '@/lib/types'

export default function SettingsPage() {
  const [settings, setSettings] = useState<DailySettings>({
    date: todayString(),
    navire: '',
    produit: '',
    client: '',
  })
  const [clients, setClients] = useState<Client[]>([])
  const [newClientName, setNewClientName] = useState('')
  const [permitDrafts, setPermitDrafts] = useState<Record<string, string>>({})
  const [pendingDeleteClient, setPendingDeleteClient] = useState<Client | null>(null)
  const [toast, setToast] = useState<ToastState | null>(null)

  useEffect(() => {
    setSettings(getSettings())
    setClients(getClients())
  }, [])

  function refreshClients() {
    setClients(getClients())
  }

  function update<K extends keyof DailySettings>(key: K, value: DailySettings[K]) {
    setSettings((prev) => ({ ...prev, [key]: value }))
  }

  function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault()
    saveSettings(settings)
    setToast({ kind: 'success', message: 'تم حفظ الإعدادات.' })
  }

  function handleAddClient(e: React.FormEvent) {
    e.preventDefault()
    const name = newClientName.trim()
    if (!name) return
    if (clients.some((c) => c.name === name)) {
      setToast({ kind: 'info', message: 'هذا الزبون موجود بالفعل.' })
      return
    }
    saveClient({ name })
    setNewClientName('')
    refreshClients()
    setToast({ kind: 'success', message: 'تمت إضافة الزبون.' })
  }

  function handleAddPermit(clientId: string) {
    const value = (permitDrafts[clientId] ?? '').trim()
    if (!value) return
    addPermit(clientId, value)
    setPermitDrafts((prev) => ({ ...prev, [clientId]: '' }))
    refreshClients()
  }

  function handleRemovePermit(clientId: string, permit: string) {
    removePermit(clientId, permit)
    refreshClients()
  }

  function confirmDeleteClient() {
    if (!pendingDeleteClient) return
    deleteClient(pendingDeleteClient.id)
    setPendingDeleteClient(null)
    refreshClients()
    setToast({ kind: 'success', message: 'تم حذف الزبون.' })
  }

  const inputClass =
    'w-full rounded-2xl border border-border bg-card px-4 py-3 text-lg text-card-foreground outline-none focus:ring-2 focus:ring-ring'
  const labelClass = 'mb-1 block text-sm font-bold text-muted-foreground'

  // DUM was intentionally removed here: it is no longer managed in settings,
  // but stays optional when entering a ticket.
  const fields: { key: keyof DailySettings; label: string; type?: string }[] = [
    { key: 'date', label: 'التاريخ', type: 'date' },
    { key: 'navire', label: 'Navire' },
    { key: 'produit', label: 'Produit' },
  ]

  return (
    <main className="min-h-dvh bg-background pb-10">
      <Header title="⚙️ الإعدادات اليومية" subtitle="تُرفق هذه القيم بسجلات اليوم" backHref="/" />
      <Toast toast={toast} onDismiss={() => setToast(null)} />

      <div className="mx-auto flex max-w-md flex-col gap-6 px-4 py-6">
        <form onSubmit={handleSaveSettings} className="flex flex-col gap-4">
          {fields.map((f) => (
            <div key={f.key}>
              <label htmlFor={f.key} className={labelClass}>
                {f.label}
              </label>
              <input
                id={f.key}
                type={f.type ?? 'text'}
                value={settings[f.key] ?? ''}
                onChange={(e) => update(f.key, e.target.value)}
                className={inputClass}
              />
            </div>
          ))}

          <div>
            <label htmlFor="client" className={labelClass}>
              الزبون الافتراضي لليوم
            </label>
            <select
              id="client"
              value={settings.client}
              onChange={(e) => update('client', e.target.value)}
              className={inputClass}
            >
              <option value="">— بدون —</option>
              {clients.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
            <p className="mt-1 text-sm text-muted-foreground">
              يُستخدم كقيمة مبدئية عند إدخال التذاكر، ويمكن تغييره لكل تذكرة.
            </p>
          </div>

          <button
            type="submit"
            className="mt-2 w-full rounded-2xl bg-settings px-4 py-4 text-lg font-bold text-settings-foreground shadow-sm active:scale-[0.98]"
          >
            💾 حفظ الإعدادات
          </button>
        </form>

        {/* Clients & permits management */}
        <section className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div>
            <h2 className="text-lg font-extrabold text-card-foreground">👥 الزبائن والتصاريح</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              أضِف الزبائن وتصاريحهم لتظهر عند إدخال التذكرة.
            </p>
          </div>

          <form onSubmit={handleAddClient} className="flex gap-2">
            <input
              value={newClientName}
              onChange={(e) => setNewClientName(e.target.value)}
              className={inputClass}
              placeholder="اسم الزبون الجديد"
            />
            <button
              type="submit"
              className="shrink-0 rounded-2xl bg-settings px-4 py-3 font-bold text-settings-foreground active:scale-[0.98]"
            >
              إضافة
            </button>
          </form>

          {clients.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-border px-4 py-6 text-center text-muted-foreground">
              لا يوجد زبائن بعد.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {clients.map((client) => (
                <div key={client.id} className="rounded-2xl border border-border bg-background p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-bold text-card-foreground">{client.name}</span>
                    <button
                      type="button"
                      onClick={() => setPendingDeleteClient(client)}
                      className="rounded-xl bg-danger/10 px-3 py-1 text-sm font-bold text-danger active:scale-[0.98]"
                    >
                      حذف
                    </button>
                  </div>

                  <div className="mt-2 flex flex-wrap gap-2">
                    {client.permits.length === 0 ? (
                      <span className="text-sm text-muted-foreground">لا توجد تصاريح</span>
                    ) : (
                      client.permits.map((permit) => (
                        <span
                          key={permit}
                          className="flex items-center gap-1 rounded-full bg-settings/10 px-3 py-1 text-sm font-bold text-settings"
                        >
                          {permit}
                          <button
                            type="button"
                            onClick={() => handleRemovePermit(client.id, permit)}
                            aria-label={`حذف التصريح ${permit}`}
                            className="text-danger"
                          >
                            ✕
                          </button>
                        </span>
                      ))
                    )}
                  </div>

                  <div className="mt-3 flex gap-2">
                    <input
                      value={permitDrafts[client.id] ?? ''}
                      onChange={(e) =>
                        setPermitDrafts((prev) => ({ ...prev, [client.id]: e.target.value }))
                      }
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.nativeEvent.isComposing && e.keyCode !== 229) {
                          e.preventDefault()
                          handleAddPermit(client.id)
                        }
                      }}
                      className="w-full rounded-xl border border-border bg-card px-3 py-2 text-card-foreground outline-none focus:ring-2 focus:ring-ring"
                      placeholder="رقم/اسم التصريح"
                    />
                    <button
                      type="button"
                      onClick={() => handleAddPermit(client.id)}
                      className="shrink-0 rounded-xl border border-border bg-card px-3 py-2 font-bold text-card-foreground active:scale-[0.98]"
                    >
                      + تصريح
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <ConfirmDialog
        open={pendingDeleteClient !== null}
        title="حذف الزبون"
        message={
          pendingDeleteClient
            ? `هل تريد حذف الزبون "${pendingDeleteClient.name}" وكل تصاريحه؟`
            : ''
        }
        confirmLabel="حذف"
        onConfirm={confirmDeleteClient}
        onCancel={() => setPendingDeleteClient(null)}
      />
    </main>
  )
}

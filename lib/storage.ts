// Local persistence layer (localStorage). Kept separate from UI.
// Simple, synchronous, and offline-friendly for the first version.

import type { Ticket, DailySettings, DailyBackup, Client } from './types'
import { calculateNet } from './calculations'

const KEYS = {
  tickets: 'riverTrucks_tickets',
  settings: 'riverTrucks_settings',
  backups: 'riverTrucks_backups',
  closedDays: 'riverTrucks_closedDays',
  clients: 'riverTrucks_clients',
  activeDate: 'riverTrucks_activeDate',
} as const

function isBrowser(): boolean {
  return typeof window !== 'undefined'
}

function read<T>(key: string, fallback: T): T {
  if (!isBrowser()) return fallback
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function write<T>(key: string, value: T): void {
  if (!isBrowser()) return
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Storage full or unavailable: fail silently, app keeps working in-memory.
  }
}

function remove(key: string): void {
  if (!isBrowser()) return
  try {
    window.localStorage.removeItem(key)
  } catch {
    // ignore
  }
}

// ---- Date helpers ----

export function todayString(date: Date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function nowTimeString(date: Date = new Date()): string {
  const h = String(date.getHours()).padStart(2, '0')
  const m = String(date.getMinutes()).padStart(2, '0')
  return `${h}:${m}`
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

// ---- Active working date ----
// Normally "today", but can point to a reopened previous day so that new
// tickets are attached to that day ("إكمال عمل سابق").

export function getActiveDate(): string {
  const stored = read<string>(KEYS.activeDate, '')
  return stored || todayString()
}

export function setActiveDate(date: string): void {
  write(KEYS.activeDate, date)
}

export function resetActiveDate(): void {
  remove(KEYS.activeDate)
}

// ---- Tickets ----

export function getTickets(): Ticket[] {
  return read<Ticket[]>(KEYS.tickets, [])
}

function persistTickets(tickets: Ticket[]): void {
  write(KEYS.tickets, tickets)
}

export function getTodayTickets(date: string = getActiveDate()): Ticket[] {
  return getTickets().filter((t) => t.date === date)
}

export function saveTicket(input: Omit<Ticket, 'id' | 'net' | 'cumul'>): Ticket {
  const tickets = getTickets()
  const net = calculateNet(input.gross, input.tare)
  const ticket: Ticket = {
    ...input,
    id: generateId(),
    net,
    cumul: 0,
  }
  tickets.push(ticket)
  const updated = recalcCumul(tickets, ticket.date)
  persistTickets(updated)
  return updated.find((t) => t.id === ticket.id) as Ticket
}

export function updateTicket(id: string, patch: Partial<Ticket>): Ticket | null {
  const tickets = getTickets()
  const idx = tickets.findIndex((t) => t.id === id)
  if (idx === -1) return null
  const merged: Ticket = { ...tickets[idx], ...patch }
  merged.net = calculateNet(merged.gross, merged.tare)
  tickets[idx] = merged
  const updated = recalcCumul(tickets, merged.date)
  persistTickets(updated)
  return updated.find((t) => t.id === id) ?? null
}

export function deleteTicket(id: string): void {
  const tickets = getTickets()
  const target = tickets.find((t) => t.id === id)
  if (!target) return
  const remaining = tickets.filter((t) => t.id !== id)
  const updated = recalcCumul(remaining, target.date)
  persistTickets(updated)
}

export function getTicketById(id: string): Ticket | null {
  return getTickets().find((t) => t.id === id) ?? null
}

// Clean, simple cumul recompute for a date, preserving array order.
function recalcCumul(tickets: Ticket[], date: string): Ticket[] {
  let running = 0
  return tickets.map((t) => {
    if (t.date !== date) return t
    running += t.net
    return { ...t, cumul: running }
  })
}

// ---- Clients & permits ----

export function getClients(): Client[] {
  return read<Client[]>(KEYS.clients, [])
}

function persistClients(clients: Client[]): void {
  write(KEYS.clients, clients)
}

// Upsert a client by id (or create a new one when id is empty).
export function saveClient(input: { id?: string; name: string; permits?: string[] }): Client {
  const clients = getClients()
  const name = input.name.trim()
  if (input.id) {
    const idx = clients.findIndex((c) => c.id === input.id)
    if (idx !== -1) {
      clients[idx] = { ...clients[idx], name, permits: input.permits ?? clients[idx].permits }
      persistClients(clients)
      return clients[idx]
    }
  }
  const client: Client = { id: generateId(), name, permits: input.permits ?? [] }
  clients.push(client)
  persistClients(clients)
  return client
}

export function deleteClient(id: string): void {
  persistClients(getClients().filter((c) => c.id !== id))
}

export function addPermit(clientId: string, permit: string): void {
  const value = permit.trim()
  if (!value) return
  const clients = getClients()
  const client = clients.find((c) => c.id === clientId)
  if (!client) return
  if (!client.permits.includes(value)) {
    client.permits.push(value)
    persistClients(clients)
  }
}

export function removePermit(clientId: string, permit: string): void {
  const clients = getClients()
  const client = clients.find((c) => c.id === clientId)
  if (!client) return
  client.permits = client.permits.filter((p) => p !== permit)
  persistClients(clients)
}

export function getPermitsForClient(clientName: string): string[] {
  const client = getClients().find((c) => c.name === clientName)
  return client ? client.permits : []
}

// ---- Settings ----

export function getSettings(): DailySettings {
  const date = todayString()
  return read<DailySettings>(KEYS.settings, {
    date,
    navire: '',
    produit: '',
    client: '',
  })
}

export function saveSettings(settings: DailySettings): void {
  write(KEYS.settings, settings)
}

// ---- Daily backups / end of day ----

export function getBackups(): DailyBackup[] {
  return read<DailyBackup[]>(KEYS.backups, [])
}

export function getBackupByDate(date: string): DailyBackup | null {
  return getBackups().find((b) => b.date === date) ?? null
}

export function saveDailyBackup(backup: DailyBackup): void {
  const backups = getBackups().filter((b) => b.date !== backup.date)
  backups.push(backup)
  backups.sort((a, b) => a.date.localeCompare(b.date))
  write(KEYS.backups, backups)

  const closed = read<string[]>(KEYS.closedDays, [])
  if (backup.closed && !closed.includes(backup.date)) {
    closed.push(backup.date)
    write(KEYS.closedDays, closed)
  }
}

export function isDayClosed(date: string = getActiveDate()): boolean {
  return read<string[]>(KEYS.closedDays, []).includes(date)
}

// Reopen a previously closed day to continue entering tickets ("إكمال عمل سابق").
// Removes it from the closed list, marks its backup as open, and makes it the
// active working day so new tickets attach to it.
export function reopenDay(date: string): void {
  const closed = read<string[]>(KEYS.closedDays, []).filter((d) => d !== date)
  write(KEYS.closedDays, closed)

  const backups = getBackups()
  const backup = backups.find((b) => b.date === date)
  if (backup) {
    backup.closed = false
    write(KEYS.backups, backups)
  }
  setActiveDate(date)
}

// List days that were closed, most recent first, for the "resume" picker.
export function getClosedDays(): string[] {
  return read<string[]>(KEYS.closedDays, []).slice().sort((a, b) => b.localeCompare(a))
}

// Previous-day total: latest backup strictly before `date`.
// If its settings match the current settings, its total is used as T. Antérieur.
export function getPreviousDayTotal(
  currentSettings?: DailySettings,
  date: string = getActiveDate(),
): number {
  const backups = getBackups()
    .filter((b) => b.date < date)
    .sort((a, b) => b.date.localeCompare(a.date))
  const previous = backups[0]
  if (!previous) return 0
  if (!currentSettings) return previous.totalNet
  const same =
    previous.settings.navire === currentSettings.navire &&
    previous.settings.produit === currentSettings.produit &&
    previous.settings.client === currentSettings.client
  return same ? previous.totalNet : 0
}

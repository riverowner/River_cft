// Central type definitions for River Trucks.

export interface Ticket {
  id: string
  ticketNo: string
  truckNo: string
  gross: number
  tare: number
  net: number
  cumul: number
  shift: number
  date: string // YYYY-MM-DD
  time: string // HH:MM
  client?: string // الزبون المرتبط بالتذكرة
  permit?: string // التصريح المختار لهذا الزبون
  dum?: string // اختياري: يُدخل عند الحاجة فقط
}

// الزبون مع تصاريحه الخاصة، تُدار من الإعدادات.
export interface Client {
  id: string
  name: string
  permits: string[]
}

export interface DailySettings {
  date: string
  navire: string
  produit: string
  client: string
  // dum لم يعد يُدار من الإعدادات، لكنه يبقى في النوع للتوافق مع البيانات القديمة.
  dum?: string
}

export interface DailyBackup {
  date: string
  settings: DailySettings
  tickets: Ticket[]
  totalNet: number
  closed: boolean
  savedAt: string
}

export interface DailyStats {
  count: number
  totalGross: number
  totalTare: number
  totalNet: number
}

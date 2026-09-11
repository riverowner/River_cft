'use client'

import { useEffect, useState } from 'react'
import { ActionButton } from '@/components/ActionButton'
import { StatsCards } from '@/components/StatsCards'
import {
  getTodayTickets,
  todayString,
  getActiveDate,
  isDayClosed,
  getClosedDays,
} from '@/lib/storage'
import { calculateDailyStats } from '@/lib/calculations'
import { getCurrentShift, getShiftLabel } from '@/lib/shifts'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="px-1 text-lg font-extrabold text-foreground">{title}</h2>
      {children}
    </section>
  )
}

export function Dashboard() {
  const [count, setCount] = useState(0)
  const [totalNet, setTotalNet] = useState(0)
  const [shift, setShift] = useState(1)
  const [activeDate, setActiveDate] = useState('')
  const [closed, setClosed] = useState(false)
  const [hasClosedDays, setHasClosedDays] = useState(false)

  useEffect(() => {
    const active = getActiveDate()
    const tickets = getTodayTickets(active)
    const stats = calculateDailyStats(tickets)
    setCount(stats.count)
    setTotalNet(stats.totalNet)
    setShift(getCurrentShift())
    setActiveDate(active)
    setClosed(isDayClosed(active))
    setHasClosedDays(getClosedDays().length > 0)
  }, [])

  const isToday = activeDate === todayString()

  return (
    <div className="flex flex-col gap-6">
      <StatsCards
        items={[
          { label: 'يوم العمل', value: activeDate || '—' },
          { label: 'الوردية الحالية', value: getShiftLabel(shift) },
          { label: 'عدد التذاكر', value: count },
          { label: 'الوزن الصافي الإجمالي', value: totalNet, accent: true },
        ]}
      />

      {!isToday && activeDate ? (
        <p className="rounded-2xl bg-camera/10 px-4 py-3 text-center font-bold text-camera-foreground">
          أنت تعمل على يوم سابق ({activeDate}). يمكنك العودة لليوم الحالي من صفحة التصدير.
        </p>
      ) : null}

      {closed ? (
        <p className="rounded-2xl bg-reports/10 px-4 py-3 text-center font-bold text-reports">
          تم إنهاء وحفظ بيانات هذا اليوم. يمكنك مراجعتها أو بدء يوم جديد.
        </p>
      ) : null}

      <Section title="🎯 العمليات الرئيسية">
        <ActionButton
          href="/manual"
          variant="manual"
          size="lg"
          emoji="✏️"
          label="إدخال البيانات يدوياً"
          subtitle="الطريقة الأساسية لإنشاء تذكرة"
          className="min-h-28"
        />
        <ActionButton
          href="/capture"
          variant="camera"
          emoji="📷"
          label="التقاط تذكرة بالكاميرا"
          subtitle="اختياري - يملأ النموذج تلقائياً"
        />
      </Section>

      <Section title="⚡ عمليات سريعة">
        <div className="grid grid-cols-2 gap-3">
          <ActionButton href="/reports" variant="reports" emoji="📊" label="التقارير" />
          <ActionButton href="/settings" variant="settings" emoji="⚙️" label="الإعدادات" />
        </div>
        <ActionButton href="/tickets" variant="neutral" emoji="📋" label="تذاكر اليوم" />
      </Section>

      <Section title="💾 البيانات والتصدير">
        <ActionButton
          href="/export"
          variant="export"
          emoji="📤"
          label="تصدير ومشاركة البيانات"
        />
        <ActionButton
          href="/export?endDay=1"
          variant="danger"
          emoji="🏁"
          label="إنهاء اليوم وحفظ البيانات"
        />
        {hasClosedDays ? (
          <ActionButton
            href="/export"
            variant="neutral"
            emoji="↩️"
            label="إكمال عمل سابق"
            subtitle="إعادة فتح يوم منتهٍ ومتابعة الإدخال"
          />
        ) : null}
      </Section>
    </div>
  )
}

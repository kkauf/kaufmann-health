'use client'

import * as React from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from '@/components/ui/dialog'
import { CheckCircle2, TrendingUp } from 'lucide-react'

// Realistic scenario: 20 sessions at €100/session
// KH: 25% for first 10 sessions, then 0%
// Total: €2,000 | KH: €250 | Therapist: €1,750

function EarningsChart() {
  const width = 320
  const height = 180
  const padding = { top: 30, right: 20, bottom: 40, left: 50 }
  const chartWidth = width - padding.left - padding.right
  const chartHeight = height - padding.top - padding.bottom

  const maxY = 2000
  const maxX = 20

  const scaleX = (x: number) => padding.left + (x / maxX) * chartWidth
  const scaleY = (y: number) => padding.top + chartHeight - (y / maxY) * chartHeight

  // Data points
  const sessions = [0, 5, 10, 15, 20]
  const totalRevenue = [0, 500, 1000, 1500, 2000]
  const khCommission = [0, 125, 250, 250, 250]

  // Therapist area (between total revenue and KH commission)
  const therapistAreaPath =
    sessions.map((s, i) => `${i === 0 ? 'M' : 'L'} ${scaleX(s)} ${scaleY(totalRevenue[i])}`).join(' ') +
    sessions.slice().reverse().map((s, i) => ` L ${scaleX(s)} ${scaleY(khCommission[sessions.length - 1 - i])}`).join('') + ' Z'

  // KH area (bottom)
  const khAreaPath =
    sessions.map((s, i) => `${i === 0 ? 'M' : 'L'} ${scaleX(s)} ${scaleY(khCommission[i])}`).join(' ') +
    ` L ${scaleX(20)} ${scaleY(0)} L ${scaleX(0)} ${scaleY(0)} Z`

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full max-w-xs mx-auto" aria-label="Einnahmenverteilung bei 20 Sitzungen">
      {/* Grid lines */}
      {[0, 500, 1000, 1500, 2000].map((y) => (
        <line
          key={y}
          x1={padding.left}
          y1={scaleY(y)}
          x2={width - padding.right}
          y2={scaleY(y)}
          stroke="#f1f5f9"
          strokeWidth="1"
        />
      ))}

      {/* Y-axis labels */}
      {[0, 1000, 2000].map((y) => (
        <text
          key={y}
          x={padding.left - 8}
          y={scaleY(y)}
          textAnchor="end"
          alignmentBaseline="middle"
          className="text-[10px] fill-gray-400"
        >
          €{y.toLocaleString('de-DE')}
        </text>
      ))}

      {/* X-axis labels */}
      {[0, 10, 20].map((s) => (
        <text
          key={s}
          x={scaleX(s)}
          y={height - padding.bottom + 16}
          textAnchor="middle"
          className="text-[10px] fill-gray-400"
        >
          {s}
        </text>
      ))}
      <text
        x={width / 2}
        y={height - 6}
        textAnchor="middle"
        className="text-[10px] fill-gray-500"
      >
        Sitzungen
      </text>

      {/* Therapist earnings area (green) */}
      <path d={therapistAreaPath} fill="#10b981" opacity="0.2" />

      {/* KH commission area (indigo) */}
      <path d={khAreaPath} fill="#6366f1" opacity="0.25" />

      {/* Total revenue line */}
      <path
        d={sessions.map((s, i) => `${i === 0 ? 'M' : 'L'} ${scaleX(s)} ${scaleY(totalRevenue[i])}`).join(' ')}
        fill="none"
        stroke="#10b981"
        strokeWidth="2.5"
        strokeLinecap="round"
      />

      {/* KH commission line */}
      <path
        d={sessions.map((s, i) => `${i === 0 ? 'M' : 'L'} ${scaleX(s)} ${scaleY(khCommission[i])}`).join(' ')}
        fill="none"
        stroke="#6366f1"
        strokeWidth="2"
        strokeLinecap="round"
      />

      {/* Vertical marker at session 10 */}
      <line
        x1={scaleX(10)}
        y1={scaleY(0)}
        x2={scaleX(10)}
        y2={scaleY(1000)}
        stroke="#6366f1"
        strokeWidth="1"
        strokeDasharray="4 2"
        opacity="0.4"
      />

      {/* Labels in the areas */}
      <text x={scaleX(14)} y={scaleY(1200)} textAnchor="middle" className="text-[11px] fill-emerald-700 font-semibold">
        €1.750
      </text>
      <text x={scaleX(14)} y={scaleY(1200) + 13} textAnchor="middle" className="text-[9px] fill-emerald-600">
        für dich
      </text>

      <text x={scaleX(14)} y={scaleY(125)} textAnchor="middle" className="text-[10px] fill-indigo-600 font-medium">
        €250
      </text>

      {/* Legend */}
      <g transform={`translate(${padding.left}, ${padding.top - 18})`}>
        <rect x="0" y="-5" width="10" height="10" fill="#10b981" opacity="0.3" rx="2" />
        <text x="14" y="3" className="text-[9px] fill-gray-600">Du behältst</text>
        <rect x="80" y="-5" width="10" height="10" fill="#6366f1" opacity="0.35" rx="2" />
        <text x="94" y="3" className="text-[9px] fill-gray-600">Kaufmann Health</text>
      </g>
    </svg>
  )
}

interface FairPricingModalProps {
  trigger: React.ReactNode
}

export function FairPricingModal({ trigger }: FairPricingModalProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl sm:text-2xl font-bold text-gray-900">
            Du behältst, was du verdienst
          </DialogTitle>
          <DialogDescription className="text-base text-gray-600">
            Nach 10 Sitzungen endet unsere Beteiligung. Für immer.
          </DialogDescription>
        </DialogHeader>

        {/* Zero Risk Section */}
        <div className="mt-4 rounded-xl border border-emerald-200/60 bg-gradient-to-br from-emerald-50/60 to-white p-4">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-emerald-600" />
            Null Risiko für dich
          </h3>
          <ul className="mt-3 space-y-2 text-sm text-gray-700">
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5 flex-shrink-0" />
              <span><strong>0 Sitzungen = 0€ Kosten</strong> – du zahlst nur bei Erfolg</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5 flex-shrink-0" />
              <span><strong>Klient:in bricht ab?</strong> Keine weitere Beteiligung</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5 flex-shrink-0" />
              <span><strong>Klient:in bleibt Jahre?</strong> Nach 10 Sitzungen behältst du 100%</span>
            </li>
          </ul>
        </div>

        {/* Chart */}
        <div className="mt-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">
            Beispiel: 20 Sitzungen à €100
          </h3>
          <EarningsChart />
          <p className="mt-2 text-xs text-gray-500 text-center">
            Du behältst <span className="font-semibold text-emerald-700">€1.750 von €2.000</span> – das sind 87,5%
          </p>
        </div>

        {/* Math Breakdown */}
        <div className="mt-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">So rechnet es sich</h3>
          <div className="rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-gray-700">Bei €100/Sitzung</th>
                  <th className="px-4 py-2 text-right font-medium text-gray-700">Du behältst</th>
                  <th className="px-4 py-2 text-right font-medium text-gray-700">Wir erhalten</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                <tr>
                  <td className="px-4 py-2.5 text-gray-700">Sitzung 1–10</td>
                  <td className="px-4 py-2.5 text-right font-medium text-gray-900">75€</td>
                  <td className="px-4 py-2.5 text-right text-gray-600">25€</td>
                </tr>
                <tr className="bg-emerald-50/50">
                  <td className="px-4 py-2.5 text-gray-700">Sitzung 11+</td>
                  <td className="px-4 py-2.5 text-right font-semibold text-emerald-700">100€</td>
                  <td className="px-4 py-2.5 text-right text-emerald-600 font-medium">0€</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Competitor Comparison */}
        <div className="mt-6 rounded-lg bg-slate-50 p-4">
          <h3 className="text-sm font-semibold text-gray-900">Im Vergleich</h3>
          <p className="mt-2 text-sm text-gray-600 leading-relaxed">
            Typische Plattformen nehmen <strong>25–40% von jeder Sitzung</strong> – für immer.
            Bei uns endet die Beteiligung nach 10 Sitzungen. Langfristige Klient:innen-Beziehungen
            gehören dir zu 100%.
          </p>
        </div>

        {/* VAT Transparency Note */}
        <div className="mt-4 rounded-lg border border-gray-200 bg-white p-4">
          <h3 className="text-sm font-semibold text-gray-900">Keine versteckten Kosten</h3>
          <p className="mt-2 text-sm text-gray-600 leading-relaxed">
            Wir behalten nur <strong>21% netto</strong>. Die restlichen ~4% sind Umsatzsteuer,
            die du im Reverse-Charge-Verfahren (§ 13b UStG) selbst abführst. 25% effektiv –
            keine Überraschungen.
          </p>
        </div>

        {/* Win-Win */}
        <div className="mt-4 text-center">
          <p className="text-sm font-medium text-gray-700">
            Win-Win: Du wächst, wir freuen uns mit.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default FairPricingModal

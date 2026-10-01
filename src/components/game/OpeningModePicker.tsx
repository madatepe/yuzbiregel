import type { OpenKind } from '@engine/index.ts'

interface OpeningModePickerProps {
  mode: OpenKind
  onChange: (mode: OpenKind) => void
  progress: number
  target: number
  invalid: boolean
}

export function OpeningModePicker({ mode, onChange, progress, target, invalid }: OpeningModePickerProps) {
  const pct = Math.min(100, (progress / target) * 100)
  const reached = progress >= target
  return (
    <div className="flex items-center gap-3">
      <div role="radiogroup" aria-label="Açılış türü" className="flex rounded-xl bg-black/30 p-0.5">
        {(['series', 'pairs'] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={mode === m}
            onClick={() => onChange(m)}
            className={`h-8 rounded-[10px] px-3 text-xs font-black tracking-wider transition-all duration-150 ${mode === m ? 'bg-ivory-50 text-felt-900 shadow' : 'text-ivory-300 hover:text-ivory-50'}`}
          >
            {m === 'series' ? 'SERİ' : 'ÇİFT'}
          </button>
        ))}
      </div>
      <div className="flex min-w-28 flex-col gap-1">
        <span className={`text-xs font-bold tabular-nums ${invalid ? 'text-warning' : reached ? 'text-success' : 'text-ivory-200'}`} aria-live="polite">
          {mode === 'series' ? `Toplam: ${progress} / ${target}` : `Çift: ${progress} / ${target}`}
          {invalid && <span className="ml-1 font-semibold">· per tamamlanmadı</span>}
        </span>
        <div className="h-1.5 overflow-hidden rounded-full bg-black/40" aria-hidden>
          <div
            className={`h-full rounded-full transition-all duration-200 ${reached && !invalid ? 'bg-success' : invalid ? 'bg-warning/70' : 'bg-accent'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  )
}

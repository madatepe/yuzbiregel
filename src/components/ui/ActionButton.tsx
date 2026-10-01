import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success'
type Size = 'sm' | 'md' | 'lg'

interface ActionButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  hint?: ReactNode
  loading?: boolean
  icon?: ReactNode
  block?: boolean
}

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-gradient-to-b from-accent-strong to-accent text-accent-ink shadow-[0_3px_0_#b9821a,0_8px_18px_rgb(246_185_59/0.25)] hover:brightness-105 active:translate-y-[2px] active:shadow-[0_1px_0_#b9821a]',
  success:
    'bg-gradient-to-b from-[#5fe0a5] to-success text-[#05301d] shadow-[0_3px_0_#1f9a63,0_8px_18px_rgb(60_207_142/0.2)] hover:brightness-105 active:translate-y-[2px] active:shadow-[0_1px_0_#1f9a63]',
  secondary:
    'bg-white/10 text-ivory-50 ring-1 ring-white/15 shadow-[0_3px_0_rgb(0_0_0/0.3)] hover:bg-white/15 active:translate-y-[2px] active:shadow-none',
  ghost: 'bg-transparent text-ivory-200 hover:bg-white/8 hover:text-ivory-50',
  danger:
    'bg-gradient-to-b from-[#ff8080] to-danger text-[#3b0606] shadow-[0_3px_0_#b83a3a] hover:brightness-105 active:translate-y-[2px] active:shadow-none',
}

const SIZES: Record<Size, string> = {
  sm: 'h-9 px-3 text-sm rounded-lg gap-1.5',
  md: 'h-11 px-5 text-[15px] rounded-xl gap-2',
  lg: 'h-14 px-7 text-lg rounded-2xl gap-2.5',
}

export function ActionButton({
  variant = 'primary',
  size = 'md',
  hint,
  loading,
  icon,
  block,
  className = '',
  children,
  disabled,
  ...rest
}: ActionButtonProps) {
  const isDisabled = disabled || loading
  return (
    <div className={`inline-flex flex-col items-center gap-1 ${block ? 'w-full' : ''}`}>
      <button
        type="button"
        {...rest}
        disabled={isDisabled}
        aria-busy={loading || undefined}
        className={`relative inline-flex items-center justify-center font-bold tracking-wide uppercase transition-all duration-150 disabled:opacity-45 disabled:saturate-50 disabled:shadow-none disabled:active:translate-y-0 ${VARIANTS[variant]} ${SIZES[size]} ${block ? 'w-full' : ''} ${className}`}
      >
        {loading ? (
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />
        ) : (
          icon
        )}
        {children}
      </button>
      {hint && <span className="text-[11px] font-medium text-ivory-300/80">{hint}</span>}
    </div>
  )
}

export function FocusCard({ percent = 0, headline, subline }) {
  const deg = Math.round(percent * 3.6)
  return (
    <div
      data-testid="focus-card"
      className="relative overflow-hidden rounded-3xl p-5 text-white bg-brand-gradient shadow-[0_10px_28px_rgba(124,111,247,.32)]"
    >
      <span aria-hidden="true" className="absolute -top-10 -right-8 w-[150px] h-[150px] rounded-full bg-white/15" />
      <div className="relative flex items-center gap-4">
        <div
          className="w-[74px] h-[74px] rounded-full grid place-items-center shrink-0"
          style={{ background: `conic-gradient(#fff ${deg}deg, rgba(255,255,255,.28) 0)` }}
        >
          <div className="w-[58px] h-[58px] rounded-full bg-[rgba(0,0,0,.12)] grid place-items-center text-center leading-none">
            <div>
              <div className="text-lg font-bold font-display">{percent}</div>
              <div className="text-[9px] font-bold tracking-wider opacity-80">DONE</div>
            </div>
          </div>
        </div>
        <div className="min-w-0">
          <div className="text-[12px] font-bold tracking-wide uppercase opacity-80">Today's focus</div>
          <div className="text-[17px] font-bold font-display leading-tight mt-0.5">{headline}</div>
          <div className="text-[12.5px] opacity-85 mt-0.5">{subline}</div>
        </div>
      </div>
    </div>
  )
}

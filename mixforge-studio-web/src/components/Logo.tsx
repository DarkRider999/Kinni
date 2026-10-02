// The brand mark: five EQ bars, cyan -> violet -> magenta, matching public/icon-source.svg (the
// app/launcher icon) so the in-app logo and the home-screen icon read as the same brand.
interface LogoProps {
  size?: number
  animated?: boolean
  className?: string
}

const BAR_HEIGHTS = [40, 62, 84, 68, 48]

export function Logo({ size = 96, animated = false, className }: LogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      className={[className, animated ? 'logo-animated' : ''].filter(Boolean).join(' ')}
      role="img"
      aria-label="MixForge Studio"
    >
      <defs>
        <linearGradient id="logo-bars" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#00f5ff" />
          <stop offset="55%" stopColor="#8b5cf6" />
          <stop offset="100%" stopColor="#ff2dd1" />
        </linearGradient>
      </defs>
      {BAR_HEIGHTS.map((h, i) => {
        const barWidth = 12
        const gap = 7
        const totalWidth = BAR_HEIGHTS.length * barWidth + (BAR_HEIGHTS.length - 1) * gap
        const startX = (120 - totalWidth) / 2
        const x = startX + i * (barWidth + gap)
        const y = 60 - h / 2
        return (
          <rect
            key={i}
            className="logo-bar"
            style={{ animationDelay: `${i * 0.12}s`, transformOrigin: `${x + barWidth / 2}px 60px` }}
            x={x}
            y={y}
            width={barWidth}
            height={h}
            rx={4}
            fill="url(#logo-bars)"
          />
        )
      })}
    </svg>
  )
}

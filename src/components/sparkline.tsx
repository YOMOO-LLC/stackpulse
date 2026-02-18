interface SparklineProps {
  values: number[]
  width?: number
  height?: number
  color?: string
  className?: string
}

export function Sparkline({
  values,
  width = 80,
  height = 24,
  color = '#10b981',
  className = '',
}: SparklineProps) {
  if (values.length === 0) {
    return (
      <svg width={width} height={height} className={className}>
        <polyline points="" fill="none" stroke={color} strokeWidth="1.5" />
      </svg>
    )
  }

  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1

  const padding = 2
  const innerWidth = width - padding * 2
  const innerHeight = height - padding * 2

  const points = values
    .map((v, i) => {
      const x = padding + (i / Math.max(values.length - 1, 1)) * innerWidth
      const y = padding + innerHeight - ((v - min) / range) * innerHeight
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')

  return (
    <svg width={width} height={height} className={className}>
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  )
}

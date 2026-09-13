// Shared segmented ring chart — used wherever a spend/revenue breakdown needs
// a compact visual (owner Analytics category donut, garage Revenue-by-category).
import React from 'react'
import Svg, { Circle } from 'react-native-svg'

export default function DonutChart({ segments, size = 116, strokeWidth = 16, trackColor }: {
  segments: { amount: number; color: string }[]
  size?: number
  strokeWidth?: number
  trackColor: string
}) {
  const total = segments.reduce((s, x) => s + x.amount, 0)
  const r = (size - strokeWidth) / 2
  const cx = size / 2, cy = size / 2
  const circumference = 2 * Math.PI * r
  let cumulative = 0
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Circle cx={cx} cy={cy} r={r} stroke={trackColor} strokeWidth={strokeWidth} fill="none" opacity={0.25} />
      {total > 0 && segments.filter(s => s.amount > 0).map((s, i) => {
        const dash = (s.amount / total) * circumference
        const offset = -cumulative
        cumulative += dash
        return (
          <Circle
            key={i} cx={cx} cy={cy} r={r} stroke={s.color} strokeWidth={strokeWidth} fill="none"
            strokeDasharray={`${dash} ${circumference - dash}`}
            strokeDashoffset={offset}
            strokeLinecap="butt"
            rotation="-90" origin={`${cx}, ${cy}`}
          />
        )
      })}
    </Svg>
  )
}

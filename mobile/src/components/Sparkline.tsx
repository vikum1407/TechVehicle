// Small SVG trend line with a soft gradient fill underneath. Extracted for
// reuse by the Vehicle Health Summary card — the original inline copy in
// VehicleDashboardScreen.tsx is left untouched to avoid any risk to that
// already-working screen; this is a separate, identical implementation.
import React from 'react'
import { View } from 'react-native'
import Svg, { Path, Defs, LinearGradient, Stop } from 'react-native-svg'

export default function Sparkline({ data, color, gradId }: {
  data: number[]
  color: string
  gradId: string
}) {
  if (data.length < 2) return <View style={{ height: 52 }} />

  const W = 140, H = 52
  const pL = 2, pR = 2, pT = 4, pB = 4
  const plotW = W - pL - pR, plotH = H - pT - pB

  const minV = Math.min(...data), maxV = Math.max(...data)
  const range = maxV - minV || 1

  const px = (i: number) => pL + (i / (data.length - 1)) * plotW
  const py = (v: number) => pT + plotH - ((v - minV) / range) * plotH
  const pts = data.map((v, i) => ({ x: px(i), y: py(v) }))

  let linePath = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`
  for (let i = 1; i < pts.length; i++) {
    const cpx = ((pts[i - 1].x + pts[i].x) / 2).toFixed(1)
    linePath += ` C ${cpx} ${pts[i - 1].y.toFixed(1)} ${cpx} ${pts[i].y.toFixed(1)} ${pts[i].x.toFixed(1)} ${pts[i].y.toFixed(1)}`
  }
  const fillPath = linePath + ` L ${pts[pts.length - 1].x} ${pT + plotH} L ${pts[0].x} ${pT + plotH} Z`

  return (
    <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
      <Defs>
        <LinearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <Stop offset="100%" stopColor={color} stopOpacity="0" />
        </LinearGradient>
      </Defs>
      <Path d={fillPath} fill={`url(#${gradId})`} />
      <Path d={linePath} stroke={color} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  )
}

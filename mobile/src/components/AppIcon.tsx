import React from 'react'
import { Ionicons, MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons'

export type AppIconSpec =
  | { lib: 'ion'; name: React.ComponentProps<typeof Ionicons>['name'] }
  | { lib: 'material'; name: React.ComponentProps<typeof MaterialIcons>['name'] }
  | { lib: 'mci'; name: React.ComponentProps<typeof MaterialCommunityIcons>['name'] }

export default function AppIcon({ icon, color, size }: { icon: AppIconSpec; color: string; size: number }) {
  if (icon.lib === 'ion') return <Ionicons name={icon.name} size={size} color={color} />
  if (icon.lib === 'material') return <MaterialIcons name={icon.name} size={size} color={color} />
  return <MaterialCommunityIcons name={icon.name} size={size} color={color} />
}

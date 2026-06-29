import React, { createContext, useContext } from 'react'
import { useColorScheme } from 'react-native'
import { lightColors, darkColors, Colors } from './colors'

const ThemeContext = createContext<Colors>(lightColors)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const scheme = useColorScheme()
  const colors = scheme === 'dark' ? darkColors : lightColors
  return <ThemeContext.Provider value={colors}>{children}</ThemeContext.Provider>
}

export function useColors(): Colors {
  return useContext(ThemeContext)
}

import React, { createContext, useContext, useState, useEffect } from 'react'
import { Appearance } from 'react-native'
import { lightColors, darkColors, Colors } from './colors'

const ThemeContext = createContext<Colors>(lightColors)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [scheme, setScheme] = useState(Appearance.getColorScheme())

  useEffect(() => {
    const sub = Appearance.addChangeListener(({ colorScheme }) => {
      setScheme(colorScheme)
    })
    return () => sub.remove()
  }, [])

  const colors = scheme === 'dark' ? darkColors : lightColors
  return <ThemeContext.Provider value={colors}>{children}</ThemeContext.Provider>
}

export function useColors(): Colors {
  return useContext(ThemeContext)
}

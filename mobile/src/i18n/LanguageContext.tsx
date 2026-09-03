import React, { createContext, useContext, useEffect, useState } from 'react'
import { storage } from '../utils/storage'
import en from './translations/en'
import si from './translations/si'
import ta from './translations/ta'
import type { TranslationKey } from './translations/en'

export type Language = 'en' | 'si' | 'ta'

const dictionaries: Record<Language, Partial<Record<TranslationKey, string>>> = { en, si, ta }

type LanguageContextValue = {
  language: Language
  setLanguage: (lang: Language) => void
  t: (key: TranslationKey, params?: Record<string, string | number>) => string
}

const LanguageContext = createContext<LanguageContextValue>({
  language: 'en',
  setLanguage: () => {},
  t: (key) => en[key] ?? key,
})

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>('en')

  useEffect(() => {
    storage.getItemAsync('language').then(saved => {
      if (saved === 'en' || saved === 'si' || saved === 'ta') setLanguageState(saved)
    }).catch(() => {})
  }, [])

  const setLanguage = (lang: Language) => {
    setLanguageState(lang)
    storage.setItemAsync('language', lang).catch(() => {})
  }

  const t = (key: TranslationKey, params?: Record<string, string | number>): string => {
    const dict = dictionaries[language]
    let str = dict[key] ?? en[key] ?? key
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        str = str.replace(`{${k}}`, String(v))
      })
    }
    return str
  }

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useTranslation(): LanguageContextValue {
  return useContext(LanguageContext)
}

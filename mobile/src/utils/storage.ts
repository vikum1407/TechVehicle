import { Platform } from 'react-native'
import * as SecureStore from 'expo-secure-store'

// expo-secure-store has no web implementation. On web, fall back to
// localStorage (fine for the web preview — not a security-sensitive target).
export const storage = {
  getItemAsync: (key: string): Promise<string | null> => {
    if (Platform.OS === 'web') {
      return Promise.resolve(typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null)
    }
    return SecureStore.getItemAsync(key)
  },
  setItemAsync: (key: string, value: string): Promise<void> => {
    if (Platform.OS === 'web') {
      if (typeof localStorage !== 'undefined') localStorage.setItem(key, value)
      return Promise.resolve()
    }
    return SecureStore.setItemAsync(key, value)
  },
  deleteItemAsync: (key: string): Promise<void> => {
    if (Platform.OS === 'web') {
      if (typeof localStorage !== 'undefined') localStorage.removeItem(key)
      return Promise.resolve()
    }
    return SecureStore.deleteItemAsync(key)
  },
}

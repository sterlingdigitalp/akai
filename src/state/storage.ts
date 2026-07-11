import { invoke } from '@tauri-apps/api/core'
import type { StateStorage } from 'zustand/middleware'
import { isTauri } from '../midi/tauri'

const tauriStorage: StateStorage = {
  getItem: (key) => invoke<string | null>('store_get', { key }),
  setItem: async (key, value) => {
    await invoke('store_set', { key, value })
  },
  removeItem: async (key) => {
    await invoke('store_set', { key, value: 'null' })
  },
}

export const woodshedStorage: StateStorage = {
  getItem: (key) => isTauri() ? tauriStorage.getItem(key) : localStorage.getItem(key),
  setItem: (key, value) => isTauri() ? tauriStorage.setItem(key, value) : localStorage.setItem(key, value),
  removeItem: (key) => isTauri() ? tauriStorage.removeItem(key) : localStorage.removeItem(key),
}

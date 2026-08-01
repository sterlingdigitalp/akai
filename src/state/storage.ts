import { invoke } from '@tauri-apps/api/core'
import type { StateStorage } from 'zustand/middleware'
import { isTauri } from '../midi/tauri'

type StorageErrorListener = (message: string) => void
const errorListeners = new Set<StorageErrorListener>()
let lastError = ''

function reportStorageError(error: unknown) {
  lastError = error instanceof Error ? error.message : String(error)
  errorListeners.forEach((listener) => listener(lastError))
}

export function subscribeStorageErrors(listener: StorageErrorListener) {
  errorListeners.add(listener)
  if (lastError) listener(lastError)
  return () => { errorListeners.delete(listener) }
}

const tauriStorage: StateStorage = {
  getItem: async (key) => {
    try { return await invoke<string | null>('store_get', { key }) }
    catch (error) { reportStorageError(error); return null }
  },
  setItem: async (key, value) => {
    try { await invoke('store_set', { key, value }) }
    catch (error) { reportStorageError(error); throw error }
  },
  removeItem: async (key) => {
    try { await invoke('store_remove', { key }) }
    catch (error) { reportStorageError(error); throw error }
  },
}

export const woodshedStorage: StateStorage = {
  getItem: (key) => {
    if (isTauri()) return tauriStorage.getItem(key)
    try { return localStorage.getItem(key) }
    catch (error) { reportStorageError(error); return null }
  },
  setItem: (key, value) => {
    if (isTauri()) return tauriStorage.setItem(key, value)
    try { localStorage.setItem(key, value) }
    catch (error) { reportStorageError(error); throw error }
  },
  removeItem: (key) => {
    if (isTauri()) return tauriStorage.removeItem(key)
    try { localStorage.removeItem(key) }
    catch (error) { reportStorageError(error); throw error }
  },
}

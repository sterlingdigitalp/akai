import type { ReactNode } from 'react'
import { useMidiStore } from '../state/midiStore'
import { useUiStore, type View } from '../state/uiStore'

const nav: { label: string; view: View }[] = [{ label: 'Home', view: 'home' }, { label: 'Playground', view: 'playground' }, { label: 'Settings', view: 'settings' }]
export function Shell({ children }: { children: ReactNode }) {
  const view = useUiStore((s) => s.view); const go = useUiStore((s) => s.go); const status = useMidiStore((s) => s.status); const name = useMidiStore((s) => s.deviceName)
  const chip = status === 'connected' ? name || 'MPK Mini' : status === 'demo' ? 'Demo mode' : 'Plug in your MPK'
  return <><header className="topbar"><button className="wordmark" onClick={() => go('home')}>Woodshed<span>.</span></button><nav aria-label="Main navigation">{nav.map((item) => <button key={item.view} className={(view === item.view || (view === 'lesson' && item.view === 'home')) ? 'active' : ''} onClick={() => go(item.view)}>{item.label}</button>)}</nav><div className={`device-chip ${status}`}><i/>{chip}</div></header><main>{children}</main></>
}

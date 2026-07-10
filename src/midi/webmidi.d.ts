interface MIDIMessageEvent extends Event { data: Uint8Array }
interface MIDIConnectionEvent extends Event { port: MIDIInput }
interface MIDIInput { id: string; name?: string; state: 'connected' | 'disconnected'; onmidimessage: ((event: MIDIMessageEvent) => void) | null }
interface MIDIInputMap { values(): IterableIterator<MIDIInput> }
interface MIDIAccess { inputs: MIDIInputMap; onstatechange: ((event: MIDIConnectionEvent) => void) | null }
interface Navigator { requestMIDIAccess?: () => Promise<MIDIAccess> }

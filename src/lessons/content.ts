import type { LessonStep } from './engine'

export type Lesson = { id: string; number: string; title: string; eyebrow: string; description: string; minutes: number; steps: LessonStep[] }
const recap = (id: string, title: string, points: string[]): LessonStep => ({ id, title, instruction: 'Nice work. You’ve built a real piece of muscle memory.', goal: { type: 'count', match: { kind: 'key' }, n: 0 }, recap: points })

export const LESSONS: Lesson[] = [
  { id: 'meet', number: '01', title: 'Meet your MPK', eyebrow: 'Start here', description: 'Get comfortable with every control, then make the keyboard yours.', minutes: 8, steps: [
    { id: 'any-key', title: 'Say hello with a key', instruction: 'Press any key. You’ll hear it and see it light up below.', goal: { type: 'event', match: { kind: 'key' } } },
    { id: 'soft-key', title: 'Play it softly', instruction: 'Try a gentle touch. Stop pressing as soon as you hear a quiet note.', hint: 'Let your finger fall from just above the key instead of pushing from your shoulder.', goal: { type: 'event', match: { kind: 'key', maxVelocity: .35 } } },
    { id: 'hard-key', title: 'Now give it some weight', instruction: 'Play a key firmly so you can feel how touch changes the sound.', hint: 'Try a quick, confident strike from a couple inches above the key.', goal: { type: 'event', match: { kind: 'key', minVelocity: .72 } } },
    { id: 'any-pad', title: 'Meet the pads', instruction: 'Tap any pad. A stronger hit makes a brighter, louder drum.', goal: { type: 'event', match: { kind: 'pad' } } },
    { id: 'cal-pads', title: 'Introduce your pads', instruction: 'Press pads 1 through 8 in order so Woodshed can recognize your layout.', hint: 'If your MPK uses its factory setup, “Use defaults” is perfectly fine.', goal: { type: 'calibrate', target: 'pads' } },
    { id: 'any-knob', title: 'Turn a knob', instruction: 'Twist any knob from side to side. Watch its marker follow you.', goal: { type: 'event', match: { kind: 'knob' } } },
    { id: 'cal-knobs', title: 'Introduce your knobs', instruction: 'Turn knobs 1 through 8, one at a time.', hint: 'A small turn is enough for each knob.', goal: { type: 'calibrate', target: 'knobs' } },
    { id: 'pitch-wheel', title: 'Bend with the pitch wheel', instruction: 'Roll the pitch wheel away from you and let it snap back. It bends the note like a guitarist bending a string.', goal: { type: 'event', match: { kind: 'pitch', deviation: .15 } } },
    { id: 'mod-wheel', title: 'Add motion with the mod wheel', instruction: 'Now push the mod wheel up. Mod adds motion — here it deepens the sound\'s vibrato.', goal: { type: 'event', match: { kind: 'mod', minVelocity: .3 } } },
    recap('meet-recap', 'You know the whole surface', ['Keys respond to your touch.', 'Pads play your drum kit.', 'Knobs and the wheels shape sound.']),
  ]},
  { id: 'keys', number: '02', title: 'Keys, chords & octaves', eyebrow: 'Play musically', description: 'Find your bearings, play a scale, and land your first chord.', minutes: 12, steps: [
    { id: 'middle-c', title: 'Find a C', instruction: 'Play any C — it’s the white key just to the left of a pair of black keys.', hint: 'Can’t reach the pitch you want? The OCT buttons shift the whole keyboard higher or lower.', goal: { type: 'notes', notes: [0], mode: 'sequence', anyOctave: true } },
    { id: 'c-scale', title: 'Walk up C major', instruction: 'Starting on C, play the eight white notes upward: C D E F G A B C.', hint: 'Go slowly. If you miss, begin again on C.', goal: { type: 'notes', notes: [0, 2, 4, 5, 7, 9, 11, 0], mode: 'sequence', anyOctave: true } },
    { id: 'c-chord', title: 'Make a C major chord', instruction: 'Play C, E, and G together. Let your hand arrive as one shape.', hint: 'Use your thumb, middle finger, and little finger.', goal: { type: 'notes', notes: [0, 4, 7], mode: 'chord', anyOctave: true, windowMs: 80 } },
    { id: 'octaves', title: 'Travel with the OCT buttons', instruction: 'Shift down and play the B below low C, then shift up and play the high C♯.', hint: 'You’re proving the same 25 keys can reach a much larger piano.', goal: { type: 'notes', notes: [47, 85], mode: 'sequence' } },
    recap('keys-recap', 'You made harmony', ['You can find C anywhere.', 'A scale is a step-by-step note map.', 'A chord is several notes speaking together.']),
  ]},
  { id: 'beat', number: '03', title: 'Your first beat', eyebrow: 'Build a groove', description: 'Learn the kit, feel the pulse, then program a two-bar-ready pattern.', minutes: 14, steps: [
    { id: 'kit', title: 'Meet your core kit', instruction: 'Play the first three pads: kick, snare, then closed hi-hat.', goal: { type: 'count', match: { kind: 'pad' }, n: 3 } },
    { id: 'kick-time', title: 'Kick on 1 and 3', instruction: 'At 90 BPM, hit pad 1 on beats 1 and 3 for two bars.', hint: 'Count “ONE, two, THREE, four.”', goal: { type: 'timing', beats: [0, 2], padIndex: 0, bpm: 90, toleranceMs: 130, hits: 4 } },
    { id: 'snare-time', title: 'Snare on 2 and 4', instruction: 'Now put pad 2 on the backbeat: beats 2 and 4 for two bars.', goal: { type: 'timing', beats: [1, 3], padIndex: 1, bpm: 90, toleranceMs: 130, hits: 4 } },
    { id: 'hat-time', title: 'Add eighth-note hats', instruction: 'Tap pad 3 twice per beat, keeping the taps even for two bars.', hint: 'Count “one AND two AND three AND four AND.”', goal: { type: 'timing', beats: [0, .5, 1, 1.5, 2, 2.5, 3, 3.5], padIndex: 2, bpm: 90, toleranceMs: 130, hits: 16 } },
    { id: 'pattern', title: 'Program the groove', instruction: 'Use the grid right below this card: place kicks on 1 and 3, snares on 2 and 4, and hats on every eighth note.', goal: { type: 'pattern', check: 'firstBeat' } },
    { id: 'play', title: 'Let it roll', instruction: 'Press play and listen to your pattern come alive.', goal: { type: 'event', match: { kind: 'pad' } } },
    recap('beat-recap', 'You built a backbeat', ['Kick gives the groove its floor.', 'Snare marks the backbeat.', 'Hi-hats divide the space between beats.']),
  ]},
  { id: 'sound', number: '04', title: 'Shape the sound', eyebrow: 'Make it yours', description: 'Use four knobs to turn one looping phrase into your own instrument.', minutes: 10, steps: [
    { id: 'cutoff', title: 'Open the filter', instruction: 'Sweep knob 1 from one end to the other. A filter is a shade that makes a sound darker or brighter.', goal: { type: 'sweep', index: 0, span: .9 } },
    { id: 'resonance', title: 'Find the filter’s edge', instruction: 'Sweep knob 2. Resonance emphasizes the filter’s edge, from smooth to a bright whistle.', goal: { type: 'sweep', index: 1, span: .9 } },
    { id: 'release', title: 'Change the tail', instruction: 'Sweep knob 3. Release controls how long a note fades after you let go.', goal: { type: 'sweep', index: 2, span: .9 } },
    { id: 'delay', title: 'Send it into space', instruction: 'Sweep knob 4. Delay repeats a little echo of what you played.', goal: { type: 'sweep', index: 3, span: .9 } },
    recap('sound-recap', 'You shaped a synth voice', ['Filter changes brightness.', 'Release changes the fade.', 'Delay turns one note into an echo.']),
  ]},
  { id: 'arp', number: '05', title: 'Set it in motion', eyebrow: 'Real hardware', description: 'Your MPK has a pattern engine built in. Wake it up and steer it.', minutes: 12, steps: [
    { id: 'arp-on', title: 'Wake the arpeggiator', instruction: 'Hold the ARP button, then press and hold a three-note chord. Your MPK rolls those notes into a pattern.', hint: 'The arp only runs while you hold the notes. Latch will free your hands in the next move.', highlight: 'arp', goal: { type: 'stream', n: 10, withinMs: 3000 } },
    { id: 'arp-latch', title: 'Let go and let it run', instruction: 'While the arp rolls, tap LATCH, then release the keys. The pattern should keep moving without your hand on the chord.', highlight: 'latch', goal: { type: 'stream', n: 16, withinMs: 6000 } },
    { id: 'arp-oct', title: 'Stretch it across octaves', instruction: 'Hold ARP and tap the key printed OCT 2, then hold your chord again. Find OCT 2 in the legend strip above the keys — on screen and on your hardware.', highlight: 'arp', goal: { type: 'stream', n: 10, withinMs: 4000, minSpan: 13 } },
    { id: 'arp-down', title: 'Turn it around', instruction: 'Hold ARP and choose the key printed DOWN, then listen as the pattern falls through your chord.', highlight: 'arp', goal: { type: 'stream', n: 10, withinMs: 4000, direction: 'down' } },
    { id: 'arp-denser', title: 'Double the density', instruction: 'Hold ARP and pick a smaller division with the printed division keys — move from 1/8 to 1/16 and hear the notes pack closer together.', highlight: 'arp', goal: { type: 'stream', n: 10, withinMs: 3000, denser: true } },
    recap('arp-recap', 'You set a chord in motion', ['An arpeggio is a chord set in motion.', 'Latch frees your hands.', 'Octaves, direction, and division shape the pattern.']),
  ]},
]

export const getLesson = (id: string | null) => LESSONS.find((lesson) => lesson.id === id) ?? LESSONS[0]

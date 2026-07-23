import { LESSONS } from '../lessons/content'
import { setDemoMode } from '../midi/midi'
import { useMidiStore } from '../state/midiStore'
import { localDay, useProgressStore } from '../state/progressStore'
import { useUiStore } from '../state/uiStore'

export function Home() {
  const status = useMidiStore((s) => s.status); const lessons = useProgressStore((s) => s.lessons); const days = useProgressStore((s) => s.practiceDays); const openLesson = useUiStore((s) => s.openLesson); const go = useUiStore((s) => s.go)
  const hasProgress = Object.values(lessons).some((item) => item.completedSteps.length)
  if ((status === 'no-device' || status === 'unsupported') && !hasProgress) return <section className="empty-state"><div className="usb-ring" aria-hidden="true"><span>⌁</span></div><p className="eyebrow">Your first session</p><h1>Plug in your MPK Mini<br/>and press any key</h1><p className="lead">Woodshed listens right in your browser. Nothing to install, and every sound is made here.</p>{status === 'unsupported' && <p className="browser-note">Open in Chrome to play with your real keyboard.</p>}<button className="button secondary" onClick={() => setDemoMode(true)}>No keyboard? Try demo mode</button></section>
  const next = LESSONS.find((lesson) => !lessons[lesson.id]?.completedAt)
  return <section className="home"><div className="hero-copy"><div><p className="eyebrow">Your practice room</p><h1>Learn the instrument<br/>under your fingers.</h1><p className="lead">Focused lessons take you from first touch to your own beat.</p></div>{next ? <button className="button primary continue" onClick={() => openLesson(next.id)}><span>Continue</span><b>{next.title}</b><i>→</i></button> : <button className="button primary continue" onClick={() => go('playground')}><span>More lessons are on the way</span><b>Keep playing</b><i>→</i></button>}</div><div className="section-heading"><div><p className="eyebrow">Lesson path</p><h2>Small steps. Real music.</h2></div><span>{Object.values(lessons).filter((l) => l.completedAt).length} of {LESSONS.length} complete</span></div><div className="lesson-grid">{LESSONS.map((lesson, index) => { const done = lessons[lesson.id]?.completedSteps.length ?? 0; const pct = done / lesson.steps.length; return <button className="lesson-card" key={lesson.id} style={{ '--delay': `${index * 60}ms` } as React.CSSProperties} onClick={() => openLesson(lesson.id)}><div className="lesson-card-top"><span className="lesson-number">{lesson.number}</span><span className="completion-ring" style={{ '--p': `${pct * 360}deg` } as React.CSSProperties}><i>{Math.round(pct * 100)}%</i></span></div><p className="eyebrow">{lesson.eyebrow}</p><h3>{lesson.title}</h3><p>{lesson.description}</p><footer><span>{lesson.steps.length - 1} moves</span><span>{lesson.minutes} min</span></footer></button> })}</div><PracticeStrip days={days}/></section>
}

function PracticeStrip({ days }: { days: string[] }) {
  const dates = Array.from({ length: 28 }, (_, index) => { const date = new Date(); date.setDate(date.getDate() - (27 - index)); return date })
  return <section className="practice-card"><div><p className="eyebrow">Last 28 days</p><h2>Practice leaves a mark.</h2></div><div className="practice-strip" aria-label={`${days.length} practice days`}>{dates.map((date) => { const iso = localDay(date); return <i key={iso} className={days.includes(iso) ? 'practiced' : ''} title={iso}/> })}</div></section>
}

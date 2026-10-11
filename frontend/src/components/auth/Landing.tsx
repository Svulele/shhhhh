import { LegalLinks } from '../legal/Legal'
import { useEffect, useRef, type CSSProperties } from 'react'
import Icon from '../Icon'
import { ThemeButton } from './AuthLayout'
import './landing.css'

type Start = (create: boolean) => void
function Header({ onStart }: { onStart: Start }) {
  return <header className="lp-header"><span className="lp-logo">Shhhhh<i>.</i></span><div className="lp-row"><ThemeButton /><button className="lp-button lp-ghost lp-small" onClick={() => onStart(false)}>Sign in</button></div></header>
}
function AnimatedHeadline() {
  const word = (text: string, index: number) => <span className="lp-word" style={{ '--d': index } as CSSProperties} key={text}>{text}</span>
  return <h1 aria-label="Your AI study buddy. Personalised for you."><span aria-hidden="true">{['Your', 'AI', 'study', 'buddy.'].map((text, i) => <span key={text}>{i > 0 && ' '}{word(text, i)}</span>)}<em>{word('Personalised', 4)} {word('for', 5)} <span className="lp-word lp-you" style={{ '--d': 6 } as CSSProperties}>you.<svg className="lp-underline" viewBox="0 0 120 12" preserveAspectRatio="none"><path pathLength="1" d="M2 8c20-6 40-6 58-3s38 3 58-2" /></svg><i className="lp-sparkle sp1" /><i className="lp-sparkle sp2" /><i className="lp-sparkle sp3" /></span></em></span></h1>
}
function Hero({ onStart }: { onStart: Start }) {
  return <section className="lp-hero"><div className="lp-mark"><Icon name="book" size={28} /></div><AnimatedHeadline /><p className="lp-lead">Not just a chatbot. Shhhhh can explain selected passages, help you practise, generate flashcards, and organise your study time.</p><div className="lp-row lp-actions"><button className="lp-button" onClick={() => onStart(true)}>Get started free<Icon name="arrow" size={18} /></button><button className="lp-button lp-ghost" onClick={() => onStart(false)}>Sign in</button></div><p className="lp-note">Free during beta · No credit card needed</p><AppPreview /></section>
}
function AppPreview() {
  return <div className="lp-card lp-preview lp-reveal" aria-label="Illustrative study space preview"><div className="lp-window"><span className="lp-dots" aria-hidden="true"><b /><b /><b /></span><span>Example preview · fictional content</span></div><div className="lp-preview-grid"><div className="lp-continue"><small>Continue studying</small><h3>Cognitive Science, p. 42</h3><div className="lp-progress"><b /></div><span className="lp-resume">Resume</span></div><div className="lp-timer"><strong>25:00</strong><small>Focus session</small></div><div className="lp-excerpt">“A sample passage from your next chapter.”<br /><span className="lp-page">Page 42 · example</span></div></div></div>
}
const features = [
  { icon: 'library', title: 'Read text-based PDFs', body: 'Read text-based PDFs and resume at your saved page.', span: 3 },
  { icon: 'ask', title: 'AI with reading context', body: 'Ask for explanations grounded in selected PDF pages.', span: 3 },
  { icon: 'cards', title: 'Auto flashcards', body: 'Generate flashcards from your reading sessions.', span: 2 },
  { icon: 'focus', title: 'Focus timer', body: 'Set a timer and choose an ambient sound.', span: 2 },
  { icon: 'flame', title: 'Daily streaks', body: 'Keep track of your study streak and progress.', span: 2 },
  { icon: 'plan', title: 'Your daily plan', body: 'Generate a plan around your goals and available time.', span: 6 },
]
function MiniVisual({ index }: { index: number }) {
  if (index === 0) return <div className="lp-visual lp-excerpt">“A sample passage for your study notes.”<br /><span className="lp-page">Page 12 · example</span></div>
  if (index === 1) return <div className="lp-visual"><div className="lp-bubble lp-user">I keep forgetting chapter 3</div><div className="lp-bubble lp-ai">Let's revisit it with 5 quick cards.</div></div>
  if (index === 2) return <div className="lp-visual lp-flashcard">What is spaced repetition?</div>
  if (index === 3) return <div className="lp-visual lp-ring"><svg viewBox="0 0 100 100" aria-hidden="true"><defs><linearGradient id="landing-timer-gradient"><stop offset="0" stopColor="#7c6cff" /><stop offset="1" stopColor="#c79bff" /></linearGradient></defs><circle cx="50" cy="50" r="44" fill="none" stroke="var(--soft)" strokeWidth="6" /><circle cx="50" cy="50" r="44" fill="none" stroke="url(#landing-timer-gradient)" strokeWidth="6" strokeLinecap="round" strokeDasharray="276" strokeDashoffset="90" /></svg><b>25:00</b></div>
  if (index === 4) return <div className="lp-visual lp-week" role="img" aria-label="Example: four study days out of seven">{Array.from({ length: 7 }, (_, i) => <i key={i} className={i < 4 ? 'filled' : ''} />)}</div>
  return <div className="lp-visual lp-plan"><div><small>Morning</small>Read chapter 4, 20 pages</div><div><small>Afternoon</small>Review 12 flashcards</div><div><small>Evening</small>Quiz on chapters 3 and 4</div></div>
}
function FeatureGrid() {
  return <section className="lp-features" aria-labelledby="landing-features"><h2 id="landing-features" className="lp-reveal">Everything you need to <em>study well</em></h2><p className="lp-sub lp-reveal">Six tools that work together, built around the way you actually learn.</p><div className="lp-bento">{features.map((feature, index) => <article className={`lp-card lp-span-${feature.span} lp-reveal`} key={feature.icon}><div className="lp-feature-icon"><Icon name={feature.icon} size={20} /></div><h3>{feature.title}</h3><p>{feature.body}</p><div className="lp-mini" role="group" aria-label="Illustrative example"><MiniVisual index={index} /></div></article>)}</div></section>
}
function FinalCta({ onStart }: { onStart: Start }) {
  return <section className="lp-card lp-final lp-reveal"><h2>Ready to study <em>smarter?</em></h2><p>Join the beta. Free. Your feedback shapes what gets built next.</p><button className="lp-button" onClick={() => onStart(true)}>Start now, it's free<Icon name="arrow" size={18} /></button></section>
}
function Footer() {
  return <footer className="lp-footer">Built with love by Svulele, for someone who inspired it.<br />Study files are stored on your device. Account details sync through Supabase.<LegalLinks /></footer>
}
export default function Landing({ onStart }: { onStart: Start }) {
  const root = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!root.current || matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) return
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting) { entry.target.classList.add('lp-visible'); observer.unobserve(entry.target) }
    }), { threshold: .12 })
    root.current.querySelectorAll<HTMLElement>('.lp-reveal').forEach((element, i) => { element.style.setProperty('--reveal-delay', `${i % 3 * 80}ms`); observer.observe(element) })
    root.current.classList.add('lp-observing')
    return () => observer.disconnect()
  }, [])
  return <div className="lp" ref={root}><div className="lp-wrap"><Header onStart={onStart} /><main><Hero onStart={onStart} /><FeatureGrid /><FinalCta onStart={onStart} /></main><Footer /></div></div>
}

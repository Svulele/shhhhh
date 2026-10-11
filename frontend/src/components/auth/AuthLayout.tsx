import { useEffect, useState, type ReactNode } from 'react'
import Icon from '../Icon'
import { initialTheme } from '../../theme'
import './auth.css'

export function ThemeButton() {
  const [theme,setTheme] = useState(initialTheme)
  useEffect(()=>{document.documentElement.dataset.theme=theme},[theme])
  useEffect(()=>{const media=matchMedia('(prefers-color-scheme: dark)');const sync=()=>{if(!localStorage.getItem('shh_theme'))setTheme(media.matches?'dark':'light')};media.addEventListener('change',sync);return()=>media.removeEventListener('change',sync)},[])
  return <button className="auth-theme round-button" aria-label={`Switch to ${theme==='light'?'dark':'light'} theme`} onClick={()=>{const next=theme==='light'?'dark':'light';localStorage.setItem('shh_theme',next);setTheme(next)}}><Icon name={theme==='light'?'moon':'sun'} size={19}/></button>
}
export function AppTile({ large=false }: { large?:boolean }) { return <div className={`auth-tile ${large?'large':''}`}><Icon name="book" size={large?38:27}/></div> }
export default function AuthLayout({children,className=''}:{children:ReactNode;className?:string}) {
  return <div className={`auth-experience ${className}`}><ThemeButton/><main className="auth-stage">{children}</main></div>
}

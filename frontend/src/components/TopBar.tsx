import { useEffect, useState } from 'react'
import { useTheme, type Page } from '../App'
import { timerStore, type TimerState } from '../timerStore'
import Icon from './Icon'
import { AccountMenu } from './Navigation'

type Weather = { current: { temperature_2m: number; weather_code: number; is_day: number }; daily: { temperature_2m_min: number[]; temperature_2m_max: number[]; precipitation_probability_max: number[]; weather_code: number[] }; city: string }
function condition(code: number) {
  if (code === 0) return { label: 'Clear skies', icon: 'sun' }
  if (code <= 2) return { label: 'Partly cloudy', icon: 'cloud-sun' }
  if (code === 3) return { label: 'Overcast', icon: 'cloud' }
  if (code <= 48) return { label: 'Foggy', icon: 'cloud' }
  if (code >= 95) return { label: 'Thunderstorms', icon: 'storm' }
  if (code >= 71 && code <= 77) return { label: 'Snow', icon: 'cloud' }
  return { label: 'Rain', icon: 'rain' }
}
function WeatherChip() {
  const [weather, setWeather] = useState<Weather | null>(null)
  useEffect(() => {
    const controller = new AbortController()
    let cancelled = false
    const load = async () => {
      let lat = -29.8587, lon = 31.0218, city = 'Durban'
      try {
        const permission = await navigator.permissions?.query({ name: 'geolocation' })
        if (permission?.state === 'granted') {
          const position = await new Promise<GeolocationPosition>((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 3000, maximumAge: 1800000 }))
          lat = Number(position.coords.latitude.toFixed(2)); lon = Number(position.coords.longitude.toFixed(2)); city = 'Your location'
        }
      } catch { /* use Durban without prompting */ }
      if (cancelled) return
      const key = `shh_weather_v2:${lat.toFixed(2)}:${lon.toFixed(2)}`
      try {
        const cached = JSON.parse(localStorage.getItem(key) || 'null')
        if (cached && Date.now() - cached.at < 1800000) { setWeather(cached.data); return }
      } catch { /* fetch fresh data */ }
      try {
        const query = new URLSearchParams({ latitude: String(lat), longitude: String(lon), current: 'temperature_2m,weather_code,is_day', daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max', timezone: 'auto', forecast_days: '2' })
        const response = await fetch(`https://api.open-meteo.com/v1/forecast?${query}`, { signal: controller.signal })
        if (!response.ok) return
        const data = { ...await response.json(), city } as Weather
        if (!Number.isFinite(data.current?.temperature_2m) || !data.daily?.temperature_2m_max) return
        if (!cancelled) setWeather(data)
        try { localStorage.setItem(key, JSON.stringify({ at: Date.now(), data })) } catch { /* cache optional */ }
      } catch { /* weather fails silently */ }
    }
    void load()
    return () => { cancelled = true; controller.abort() }
  }, [])
  if (!weather) return <span />
  const now = condition(weather.current.weather_code)
  return <div className="weather-wrap">
    <button className="ui-pill weather-chip" aria-describedby="weather-details"><Icon name={weather.current.is_day ? now.icon : now.icon === 'sun' ? 'moon' : now.icon === 'cloud-sun' ? 'cloud-moon' : now.icon} size={19} /><strong>{Math.round(weather.current.temperature_2m)}°</strong><span>{weather.city}</span></button>
    <div className="weather-popover" id="weather-details" role="tooltip"><strong>{weather.city}</strong><p>{now.label}</p><p>Today {Math.round(weather.daily.temperature_2m_min[0])}–{Math.round(weather.daily.temperature_2m_max[0])}°C · {weather.daily.precipitation_probability_max[0]}% rain</p><p>Tomorrow: {condition(weather.daily.weather_code[1]).label}, {Math.round(weather.daily.temperature_2m_max[1])}°C</p><small>Weather by Open-Meteo</small></div>
  </div>
}
export default function TopBar({ navigate, signOut, compact = false }: { navigate: (p: Page) => void; signOut: () => void; compact?: boolean }) {
  const { theme, toggle } = useTheme()
  const [timer, setTimer] = useState<TimerState>(timerStore.get)
  useEffect(() => { return timerStore.subscribe(setTimer) }, [compact])
  const mm = String(Math.floor(timer.left / 60)).padStart(2, '0'), ss = String(timer.left % 60).padStart(2, '0')
  return <header className={`study-topbar ${compact ? 'focus-topbar' : ''}`}>{!compact && <WeatherChip />}<div className="topbar-actions">{!compact && <button className="ui-pill timer-pill" aria-label={`Open ${timer.mode === 'work' ? 'focus' : 'break'} timer, ${mm}:${ss} remaining`} onClick={() => navigate('pomodoro')}><span className={`timer-dot ${timer.running ? 'running' : ''}`} /><span>{mm}:{ss}</span><small>{timer.mode === 'work' ? 'Focus' : 'Break'}</small></button>}<button className="round-button" aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`} onClick={toggle}><Icon name={theme === 'light' ? 'moon' : 'sun'} size={20} /></button><div className="mobile-account"><AccountMenu navigate={navigate} signOut={signOut} /></div></div></header>
}

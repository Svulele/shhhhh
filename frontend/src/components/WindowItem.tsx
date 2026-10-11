import { useEffect, useRef, useState, type HTMLAttributes } from 'react'

/** Keep long collections light while retaining each item's measured scroll space. */
export default function WindowItem({ enabled, children, style, ...props }: HTMLAttributes<HTMLDivElement> & { enabled: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState(220)
  const [visible, setVisible] = useState(true)
  useEffect(() => {
    const element = ref.current
    if (!enabled || !element || !('IntersectionObserver' in window)) return
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) setHeight(element.getBoundingClientRect().height || 220)
      setVisible(entry.isIntersecting || element.contains(document.activeElement))
    }, { rootMargin: '800px 0px' })
    observer.observe(element)
    return () => observer.disconnect()
  }, [enabled])
  return <div {...props} ref={ref} style={{ ...style, ...(!visible && enabled ? { minHeight: height } : {}) }}>{visible || !enabled ? children : null}</div>
}

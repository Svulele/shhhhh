export interface ViewportBaseline { width: number; height: number }
/** Retain the unobstructed height even when WKWebView also shrinks innerHeight. */
export function keyboardViewport(previous: ViewportBaseline, current: ViewportBaseline) {
  const rotated = Math.abs(current.width - previous.width) > 80
  const baseline = { width: current.width, height: rotated ? current.height : Math.max(previous.height, current.height) }
  const drop = Math.max(0, baseline.height - current.height)
  return { baseline, drop, open: drop > 150 }
}

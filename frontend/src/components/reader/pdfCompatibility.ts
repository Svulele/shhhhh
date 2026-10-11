/** PDF.js still needs this API even in its legacy distribution. */
export function installPDFCompatibility() {
  if ('withResolvers' in Promise && typeof Promise.withResolvers === 'function') return
  Object.defineProperty(Promise, 'withResolvers', {
    configurable: true,
    writable: true,
    value: function<T>(this: PromiseConstructor) {
      let resolve!: (value: T | PromiseLike<T>) => void
      let reject!: (reason?: unknown) => void
      const promise = new this<T>((yes, no) => { resolve = yes; reject = no })
      return { promise, resolve, reject }
    },
  })
}
installPDFCompatibility()

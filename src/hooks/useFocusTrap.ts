import { useEffect, useRef } from 'react'

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export function useFocusTrap(containerRef: React.RefObject<HTMLElement | null>, isOpen: boolean) {
  const returnFocusRef = useRef<Element | null>(null)

  useEffect(() => {
    if (!isOpen) return

    returnFocusRef.current = document.activeElement
    const container = containerRef.current
    if (!container) return

    const getFocusables = () => Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE))

    getFocusables()[0]?.focus()

    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Tab') return
      const focs = getFocusables()
      if (focs.length === 0) { e.preventDefault(); return }
      const first = focs[0]!
      const last = focs[focs.length - 1]!
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus() }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus() }
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      const ret = returnFocusRef.current
      if (ret instanceof HTMLElement) ret.focus()
    }
  }, [isOpen, containerRef])
}

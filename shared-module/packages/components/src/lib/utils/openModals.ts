// A modal dialog makes everything outside it inert until it has started to close, and focus()
// on an inert element silently does nothing. Focus requested meanwhile waits here.

const openModals = new Set<HTMLElement>()
const pending = new Set<() => void>()

/** Marks a modal surface as open. The returned function marks it closed and releases waiting focus. */
export const registerOpenModal = (surface: HTMLElement): (() => void) => {
  openModals.add(surface)
  return () => {
    openModals.delete(surface)
    if (openModals.size === 0) {
      const waiting = [...pending]
      pending.clear()
      waiting.forEach((run) => run())
    }
  }
}

/** True when `element` is inside an open modal, where focus can move freely. */
const isInsideOpenModal = (element: Element): boolean =>
  [...openModals].some((surface) => surface.contains(element))

/**
 * Runs `run` now, or once every open modal has started to close. Returns a function that cancels
 * it. A request made from inside an open modal (`target`) runs at once.
 */
export const runWhenNoModalOpen = (run: () => void, target?: Element): (() => void) => {
  if (openModals.size === 0 || (target !== undefined && isInsideOpenModal(target))) {
    run()
    return () => {}
  }
  pending.add(run)
  return () => {
    pending.delete(run)
  }
}

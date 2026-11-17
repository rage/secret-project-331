// jsdom has no `inert`. This gives it Chrome's behaviour: react-aria's modals mark the page
// inert, and focus() on an inert or visibility:hidden element does nothing, and focus inside a
// newly inert subtree is dropped. Import it first,
// before react-aria loads, so the feature check sees `inert`.
const INERT_ATTRIBUTE = "inert"

if (!("inert" in HTMLElement.prototype)) {
  Object.defineProperty(HTMLElement.prototype, "inert", {
    configurable: true,
    get(this: HTMLElement) {
      return this.hasAttribute(INERT_ATTRIBUTE)
    },
    set(this: HTMLElement, value: boolean) {
      this.toggleAttribute(INERT_ATTRIBUTE, value)
      // Chrome drops focus that sits inside a subtree that turns inert.
      const active = document.activeElement
      if (value && active instanceof HTMLElement && this.contains(active)) {
        active.blur()
      }
    },
  })
}

const originalFocus = HTMLElement.prototype.focus
HTMLElement.prototype.focus = function focus(this: HTMLElement, options?: FocusOptions) {
  const isHidden = window.getComputedStyle(this).visibility === "hidden"
  if (this.closest(`[${INERT_ATTRIBUTE}]`) !== null || isHidden) {
    return
  }
  originalFocus.call(this, options)
}

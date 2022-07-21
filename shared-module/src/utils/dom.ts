export function isElementFullyInViewport(element: HTMLElement): boolean {
  const boundingClientRect = element.getBoundingClientRect()
  const windowBottomY = window.innerHeight || document.documentElement.clientHeight
  const windowRightSideX = window.innerWidth || document.documentElement.clientWidth
  return (
    boundingClientRect.bottom <= windowBottomY &&
    boundingClientRect.right <= windowRightSideX &&
    boundingClientRect.top >= 0 &&
    boundingClientRect.left >= 0
  )
}

import { atom } from "jotai"

export const blockIntersectionObserverAtom = atom<IntersectionObserver | null>(null)

blockIntersectionObserverAtom.onMount = (setAtom) => {
  const intersectionCallback: IntersectionObserverCallback = (entries) => {
    entries.forEach((entry) => {
      console.log(
        entry.target.id,
        entry.isIntersecting ? "ENTERED VIEW" : "LEFT VIEW",
        entry.intersectionRatio,
      )
    })
  }

  const options = {
    root: null,
    rootMargin: "0px",
    threshold: 0.5,
  }

  const observer = new IntersectionObserver(intersectionCallback, options)

  setAtom(observer)

  return () => {
    observer.disconnect()
    setAtom(null)
  }
}

import { useEffect, useState } from "react"

/**
 * Used in Layout component to see if we are in mobile or desktop
 * @param query respondToOrLarger.xs
 */
export default function useMedia(query: string) {
  const [matches, setMatches] = useState(window.matchMedia(query).matches)

  useEffect(() => {
    const [_, ...queryWithoutMedia] = query.split(" ")
    const media = window.matchMedia(queryWithoutMedia.join(" "))
    if (media.matches !== matches) {
      setMatches(media.matches)
    }
    const listener = () => setMatches(media.matches)
    media.addEventListener("change", listener)
    return () => media.removeEventListener("change", listener)
  }, [query, matches])

  return matches
}

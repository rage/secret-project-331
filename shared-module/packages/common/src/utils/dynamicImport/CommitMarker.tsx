"use client"

import { useEffect } from "react"

interface CommitMarkerProps {
  onCommit: () => void
}

/**
 * Helper component that calls a callback when the wrapped tree commits to the DOM.
 * It mounts before the wrapped content, so a successful commit means the subtree rendered at least once.
 */
const CommitMarker = ({ onCommit }: CommitMarkerProps) => {
  useEffect(() => {
    onCommit()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return null
}

export default CommitMarker

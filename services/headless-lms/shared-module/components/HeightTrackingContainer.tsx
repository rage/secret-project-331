import { css } from "@emotion/css"
import React, { ReactNode, useEffect, useLayoutEffect, useRef, useState } from "react"
import { useDebounce } from "use-debounce"

interface Props {
  port: MessagePort | null
  children?: ReactNode
}

const HeightTrackingContainer: React.FC<Props> = ({ port, children }) => {
  const contentRef = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState(0)
  const [debouncedHeight] = useDebounce(height, 200)

  useLayoutEffect(() => {
    const ref = contentRef.current
    if (!ref || !port) {
      return
    }
    onHeightChange(ref.getBoundingClientRect().height, port)
  })

  useEffect(() => {
    const onResize = () => {
      const ref = contentRef.current
      if (!ref) {
        return
      }
      setHeight(ref.getBoundingClientRect().height)
    }
    window.addEventListener("resize", onResize)
    return () => {
      window.removeEventListener("resize", onResize)
    }
  }, [])

  // mutation observer, catches changes that don't trigger useLayoutEffect
  useEffect(() => {
    const ref = contentRef.current
    if (!ref) {
      return
    }
    const onResize = () => {
      const ref = contentRef.current
      if (!ref) {
        return
      }
      setHeight(ref.getBoundingClientRect().height)
    }
    const observer = new MutationObserver(onResize)
    observer.observe(ref, { attributes: true, childList: true, subtree: true })
    return () => {
      observer.disconnect()
    }
  }, [contentRef])

  useEffect(() => {
    if (!port) {
      return
    }
    onHeightChange(debouncedHeight, port)
  }, [debouncedHeight, port])

  return (
    <div
      // overflow: hidden required because otherwise margin-top in the children can otherwise mess up the height calculation
      className={css`
        overflow: hidden;
      `}
      ref={contentRef}
    >
      {children}
    </div>
  )
}

function onHeightChange(newHeight: number, port: MessagePort) {
  if (!port) {
    return
  }
  port.postMessage({
    message: "height-changed",
    data: newHeight,
  })
}

export default HeightTrackingContainer

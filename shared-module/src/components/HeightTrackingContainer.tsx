import React, { ReactNode, useEffect, useLayoutEffect, useRef, useState } from "react"
import { useDebounce } from "use-debounce"

interface Props {
  port: MessagePort
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
    return () => window.removeEventListener("resize", onResize)
  }, [])

  useEffect(() => {
    if (!port) {
      return
    }
    onHeightChange(debouncedHeight, port)
  }, [debouncedHeight, port])

  return <div ref={contentRef}>{children}</div>
}

function onHeightChange(newHeight: number, port: MessagePort) {
  port.postMessage({
    message: "height-changed",
    data: newHeight,
  })
}

export default HeightTrackingContainer

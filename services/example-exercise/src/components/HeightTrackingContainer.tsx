import React, { ReactNode, useLayoutEffect, useRef } from "react"

interface Props {
  port: MessagePort
  children?: ReactNode
}

const HeightTrackingContainer: React.FC<Props> = ({ port, children }) => {
  const contentRef = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const ref = contentRef.current
    if (!ref || !port) {
      return
    }
    onHeightChange(ref.getBoundingClientRect().height, port)
  })
  return <div ref={contentRef}>{children}</div>
}

function onHeightChange(newHeight: number, port: MessagePort) {
  port.postMessage({
    message: "height-changed",
    data: newHeight,
  })
}

export default HeightTrackingContainer

import { css } from "@emotion/css"
import React, { ReactNode, useEffect, useRef, useState } from "react"

import IframeHeightContext from "../contexts/IframeHeightContext"

interface Props {
  port: MessagePort | null
  children?: ReactNode
}

const HeightTrackingContainer: React.FC<
  React.PropsWithChildren<Props>
> = ({ port, children }) => {
  const contentRef = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState(0)
  const previouslySentHeightRef = useRef(0)

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

  // resize observer, catches whenever an element resizes
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
    const observer = new ResizeObserver(onResize)
    observer.observe(ref)
    return () => {
      observer.disconnect()
    }
  }, [contentRef])

  useEffect(() => {
    // To be safe, we'll check periodically whether the sent height matches the height in the document.
    const intervalId = setInterval(() => {
      if (!port) {
        return
      }
      const ref = contentRef.current
      if (!ref) {
        return
      }
      const currentHeight = ref.getBoundingClientRect().height
      if (currentHeight !== previouslySentHeightRef.current) {
        setHeight(currentHeight)
      }
      return () => {
        clearInterval(intervalId)
      }
    }, 5000)
  }, [port])

  useEffect(() => {
    // Send the updates to the parent
    if (!port || height === previouslySentHeightRef.current) {
      return
    }
    onHeightChange(height, port)
    previouslySentHeightRef.current = height
  }, [height, port])

  return (
    <IframeHeightContext.Provider value={{ height: height }}>
      <div
        // overflow: hidden required because otherwise margin-top in the children can otherwise mess up the height calculation
        className={css`
          overflow: hidden;
        `}
        ref={contentRef}
      >
        {children}
      </div>
    </IframeHeightContext.Provider>
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

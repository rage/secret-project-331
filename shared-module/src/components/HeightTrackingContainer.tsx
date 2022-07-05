import { css } from "@emotion/css"
import React, { ReactNode, useEffect, useRef, useState } from "react"

import IframeHeightContext from "../contexts/IframeHeightContext"

interface Props {
  port: MessagePort | null
  children?: ReactNode
}

const HeightTrackingContainer: React.FC<Props> = ({ port, children }) => {
  const contentRef = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState(0)
  const [previouslySentHeight, setPreviouslySentHeight] = useState(0)

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

  // mutation observer, catches changes to the DOM
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
    if (!port || height === previouslySentHeight) {
      return
    }
    onHeightChange(height, port)
    setPreviouslySentHeight(height)
  }, [height, port, previouslySentHeight])

  // To be safe, check on all React renders if we need to resend the height
  useEffect(() => {
    if (!port) {
      return
    }
    const ref = contentRef.current
    if (!ref) {
      return
    }
    const computedHeight = ref.getBoundingClientRect().height
    if (computedHeight === previouslySentHeight) {
      return
    }
    onHeightChange(height, port)
  })

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

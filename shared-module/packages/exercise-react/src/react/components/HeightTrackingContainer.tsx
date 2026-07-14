"use client"

import { css } from "@emotion/css"
import type { ReactNode } from "react"
import React, { useEffect, useRef, useState } from "react"

import IframeHeightContext from "../contexts/IframeHeightContext"

import type { HeightObserver } from "@/shared-module/exercise-client/client/heightObserver"
import { observeHeight } from "@/shared-module/exercise-client/client/heightObserver"

interface Props {
  port: MessagePort | null
  children?: ReactNode
}

/**
 * Tracks the height of its content and reports it to the parent via the port. Thin React
 * shell over the framework-agnostic `observeHeight` engine; it also exposes the current
 * height through `IframeHeightContext`.
 */
const HeightTrackingContainer: React.FC<React.PropsWithChildren<Props>> = ({ port, children }) => {
  const contentRef = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState(0)
  const observerRef = useRef<HeightObserver | null>(null)

  useEffect(() => {
    const element = contentRef.current
    if (!element) {
      return
    }
    const observer = observeHeight({ element, onHeight: setHeight })
    observerRef.current = observer
    return () => {
      observer.dispose()
      observerRef.current = null
    }
  }, [])

  // Keep the engine's port in sync without recreating the observer.
  useEffect(() => {
    observerRef.current?.setPort(port)
  }, [port])

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

export default HeightTrackingContainer

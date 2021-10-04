/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import { css } from "@emotion/css"
import React, { useEffect, useState } from "react"

const ScrollIndicator: React.FC = () => {
  const [scrolled, setScrolled] = useState("0")

  useEffect(() => {
    window.addEventListener("scroll", scrollProgress)
    window.addEventListener("resize", scrollProgress)
    return () => {
      window.removeEventListener("scroll", scrollProgress)
      window.removeEventListener("resize", scrollProgress)
    }
  }, [])

  const scrollProgress = () => {
    const scrollPx = document.documentElement.scrollTop
    const winHeightPx =
      document.documentElement.scrollHeight - document.documentElement.clientHeight
    const scrolled = `${(scrollPx / winHeightPx) * 100}%`

    setScrolled(scrolled)
  }

  return (
    <div>
      <div
        className={css`
          height: 5px;
          position: fixed;
          top: 0;
          left: 0;
          width: 100vw;
          z-index: 99;
        `}
      >
        <div
          className={css`
            height: 5px;
            background: #27f09d;
            width: ${scrolled};
          `}
        />
      </div>
    </div>
  )
}

export default ScrollIndicator

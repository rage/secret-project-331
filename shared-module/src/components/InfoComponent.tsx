import { css } from "@emotion/css"
import { InfoCircle } from "@vectopus/atlas-icons-react"
import React, { useLayoutEffect, useRef, useState } from "react"

import Button from "./Button"
import SpeechBalloon from "./SpeechBalloon"

interface TimeComponentProps {
  label?: string
  text: string
  right?: boolean
  boldLabel?: boolean
}

const TimeComponent: React.FC<
  React.PropsWithChildren<React.PropsWithChildren<TimeComponentProps>>
> = ({ label, text, right, boldLabel }) => {
  const [visible, setVisible] = useState(false)

  const speechBubbleRef = useRef<HTMLDivElement>(null)
  const parentRef = useRef<HTMLSpanElement>(null)
  const pivotPointRef = useRef<HTMLButtonElement>(null)
  const [top, setTop] = useState(0)
  const [left, setLeft] = useState(0)

  useLayoutEffect(() => {
    const speechBubble = speechBubbleRef.current
    const parent = parentRef.current
    const pivotPoint = pivotPointRef.current

    if (!speechBubble || !parent || !pivotPoint) {
      return
    }

    const rect = speechBubble.getBoundingClientRect()
    const parentRect = parent.getBoundingClientRect()
    const pivotPointRect = pivotPoint.getBoundingClientRect()

    // Relative position to parent
    const globalX = pivotPointRect.x - rect.width / 2 + pivotPointRect.width / 2
    const globalY = pivotPointRect.y - rect.height + 10

    /*
    top: -77.04998779296875px
    left: 89.13335418701172px
    */

    setLeft(globalX - parentRect.x)
    setTop(globalY - parentRect.y)
  }, [])

  return (
    <span
      className={css`
        ${right && "float: right;"}
        z-index: 1100;
        vertical-align: middle;
        position: relative;
      `}
      ref={parentRef}
    >
      <SpeechBalloon
        ref={speechBubbleRef}
        className={css`
          position: absolute;
          top: ${top}px;
          left: ${left}px;
          ${!visible && "display: none;"}
        `}
      >
        <p
          className={css`
            max-width: 17rem !important;
          `}
        >
          {text}
        </p>
      </SpeechBalloon>
      {label && (
        <span
          className={css`
            ${boldLabel && "font-weight: bold;"}
            margin-right: 0.2rem;
          `}
        >
          {label}
        </span>
      )}
      <Button
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
        size="small"
        aria-label={label}
        ref={pivotPointRef}
        className={css`
          position: relative;
          top: -1px;
        `}
        variant={"icon"}
      >
        <InfoCircle size={18} />
      </Button>
    </span>
  )
}

export default TimeComponent

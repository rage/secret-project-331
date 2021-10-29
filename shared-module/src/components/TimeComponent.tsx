import { css } from "@emotion/css"
import { IconButton } from "@material-ui/core"
import InfoIcon from "@material-ui/icons/Info"
import React, { useLayoutEffect, useRef, useState } from "react"

import { dateToString } from "../utils/time"

import SpeechBalloon from "./SpeechBalloon"

interface TimeComponentProps {
  name: string
  date: Date
  right: boolean
}

const TimeComponent: React.FC<TimeComponentProps> = ({ name, date, right }) => {
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
        <p> {dateToString(date, true)} </p>
      </SpeechBalloon>
      <strong>{name}</strong>
      <span className="time-component-date">{dateToString(date, false)}</span>
      <IconButton
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
        size="small"
        aria-label={dateToString(date, true)}
        ref={pivotPointRef}
      >
        <InfoIcon
          className={css`
            font-size: 18px;
          `}
        />
      </IconButton>
    </span>
  )
}

export default TimeComponent

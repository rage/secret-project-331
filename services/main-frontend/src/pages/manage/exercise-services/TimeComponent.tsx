import { css } from "@emotion/css"
import { IconButton } from "@material-ui/core"
import InfoIcon from "@material-ui/icons/Info"
import React, { useState } from "react"

import SpeechBalloon from "../../../shared-module/components/SpeechBalloon"
import { dateToString } from "../../../shared-module/utils/time"

interface TimeComponentProps {
  name: string
  date: Date
  right: boolean
}

const TimeComponent: React.FC<TimeComponentProps> = ({ name, date, right }) => {
  const [visible, setVisible] = useState(false)

  return (
    <span
      className={
        right &&
        css`
          float: right;
        `
      }
    >
      <span
        className={css`
          vertical-align: middle;
          position: relative;
        `}
      >
        {visible && (
          <SpeechBalloon
            className={css`
              position: absolute;
              top: -68px;
              left: 109px;
            `}
          >
            <p> {dateToString(date, true)} </p>
          </SpeechBalloon>
        )}
        <strong>{name}</strong>
        {dateToString(date, false)}
      </span>
      <IconButton
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
        size="small"
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

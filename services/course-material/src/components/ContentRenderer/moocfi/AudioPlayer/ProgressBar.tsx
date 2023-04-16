import { css, cx } from "@emotion/css"
import styled from "@emotion/styled"
import React from "react"

import { headingFont } from "../../../../shared-module/styles"

import { styledRangeInput } from "./RangeComponentStyle"

const ProgressBarWrapper = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  height: 30px;
  width: 100%;
  font-family: ${headingFont};
`
const time = css`
  color: #687eaf;
  font-size: 13px;
  line-height: 46px;
  font-weight: 500;
`

const ProgressBar = ({ progressBarRef, audioRef, timeProgress, duration }: any) => {
  const handleProgressChange = () => {
    audioRef.current.currentTime = progressBarRef.current.value
  }

  const formatTime = (time: number) => {
    if (time && !isNaN(time)) {
      const minutes = Math.floor(time / 60)
      const formattedMinutes = minutes < 10 ? `0${minutes}` : `${minutes}`
      const seconds = Math.floor(time % 60)
      const formattedSeconds = seconds < 10 ? `0${seconds}` : `${seconds}`
      return `${formattedMinutes}:${formattedSeconds}`
    }
    return "00:00"
  }

  return (
    <ProgressBarWrapper className={cx(styledRangeInput)}>
      <span className={cx(time)}>{formatTime(timeProgress)}</span>
      <input type="range" ref={progressBarRef} defaultValue="0" onChange={handleProgressChange} />
      <span className={cx(time)}>{formatTime(duration)}</span>
    </ProgressBarWrapper>
  )
}

export default ProgressBar

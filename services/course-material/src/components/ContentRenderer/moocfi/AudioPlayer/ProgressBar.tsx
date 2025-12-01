import { css, cx } from "@emotion/css"
import styled from "@emotion/styled"
import { RefObject } from "react"
import { useTranslation } from "react-i18next"

import { styledRangeInput } from "./RangeComponentStyle"

import { headingFont } from "@/shared-module/common/styles"

const ProgressBarWrapper = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  height: 30px;
  width: 100%;
  font-family: ${headingFont};
`
const time = css`
  color: #535a66;
  font-size: 13px;
  line-height: 46px;
  font-weight: 500;
`

interface ProgressBarProps {
  progressBarRef: RefObject<HTMLInputElement | null>
  audioRef: RefObject<HTMLAudioElement | null>
  timeProgress: number
  duration: number
}

const ProgressBar = ({ progressBarRef, audioRef, timeProgress, duration }: ProgressBarProps) => {
  const { t } = useTranslation()

  const handleProgressChange = () => {
    if (audioRef?.current && progressBarRef?.current) {
      audioRef.current.currentTime = Number(progressBarRef.current.value)
    }
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

  const currentTimeFormatted = formatTime(timeProgress)
  const durationFormatted = formatTime(duration)
  const ariaValueText = t("audio-player-seek-value-text", {
    currentTime: currentTimeFormatted,
    duration: durationFormatted,
  })

  return (
    <ProgressBarWrapper className={cx(styledRangeInput)}>
      <span className={cx(time)} aria-hidden="true">
        {currentTimeFormatted}
      </span>
      <input
        type="range"
        ref={progressBarRef}
        min={0}
        max={duration || 0}
        value={timeProgress}
        onChange={handleProgressChange}
        aria-label={t("audio-player-seek")}
        aria-valuemin={0}
        aria-valuemax={duration || 0}
        aria-valuenow={timeProgress}
        aria-valuetext={ariaValueText}
      />
      <span className={cx(time)} aria-hidden="true">
        {durationFormatted}
      </span>
    </ProgressBarWrapper>
  )
}

export default ProgressBar

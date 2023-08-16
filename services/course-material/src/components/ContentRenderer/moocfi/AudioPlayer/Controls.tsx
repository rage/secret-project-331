import { css, cx } from "@emotion/css"
import React, { RefObject, useCallback, useEffect, useRef, useState } from "react"

// icons
import FastForward from "../../../../img/audio-player/fast-forward.svg"
import HighVolume from "../../../../img/audio-player/high-volume.svg"
import LowVolume from "../../../../img/audio-player/low-volume.svg"
import MedVolume from "../../../../img/audio-player/med-volume.svg"
import MuteVolume from "../../../../img/audio-player/mute-volume.svg"
import Pause from "../../../../img/audio-player/pause.svg"
import Play from "../../../../img/audio-player/play.svg"
import Rewind from "../../../../img/audio-player/rewind.svg"

import { styledRangeInput } from "./RangeComponentStyle"

const styledVolume = css`
  display: flex;
  align-items: center;
  margin-top: 10px;

  button {
    margin: 0;
    border: none;
    background-color: transparent;
    cursor: pointer;
  }

  .volume svg {
    display: flex;
  }
`

interface ControlsProps {
  audioRef: RefObject<HTMLAudioElement> | null
  progressBarRef: RefObject<HTMLInputElement> | null
  duration: number
  setTimeProgress: (T: number) => void
}

const Controls = ({ audioRef, progressBarRef, duration, setTimeProgress }: ControlsProps) => {
  const [isPlaying, setIsPlaying] = useState<boolean>(false)
  const [volume, setVolume] = useState<number>(60)
  const [muteVolume, setMuteVolume] = useState<boolean>(false)

  const togglePlayPause = () => {
    setIsPlaying((prev) => !prev)
  }

  const playAnimationRef = useRef(0)

  const repeat = useCallback(() => {
    if (progressBarRef?.current && audioRef?.current) {
      const currentTime = audioRef.current.currentTime
      progressBarRef.current.value = String(currentTime)
      progressBarRef.current.style.setProperty(
        "--range-progress",
        `${(Number(progressBarRef.current.value) / duration) * 100}%`,
      )
      currentTime && setTimeProgress(currentTime)

      playAnimationRef.current = requestAnimationFrame(repeat)
    }
  }, [audioRef, duration, progressBarRef, setTimeProgress])

  useEffect(() => {
    if (audioRef?.current) {
      if (isPlaying) {
        audioRef.current.play()
        playAnimationRef.current = requestAnimationFrame(repeat)
      } else {
        audioRef.current.pause()
        cancelAnimationFrame(playAnimationRef.current)
      }
    }
  }, [isPlaying, audioRef, audioRef?.current?.readyState, repeat])

  const skipForward = () => {
    if (audioRef?.current) {
      audioRef.current.currentTime += 15
    }
  }

  const skipBackward = () => {
    if (audioRef?.current) {
      audioRef.current.currentTime -= 15
    }
  }

  useEffect(() => {
    if (audioRef?.current) {
      audioRef.current.volume = volume / 100
      audioRef.current.muted = muteVolume
    }
  }, [volume, audioRef, muteVolume])

  return (
    <div
      className={css`
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        margin-top: 5px;
      `}
    >
      <div
        className={css`
          display: flex;
          align-items: center;

          button {
            display: flex;
            border: none;
            margin-right: 6px;
            margin-bottom: 5px;
            background-color: transparent;
            cursor: pointer;
            justify-content: center;
          }
        `}
      >
        <button onClick={skipBackward}>
          <Rewind />
        </button>

        <button onClick={togglePlayPause}>{isPlaying ? <Pause /> : <Play />}</button>
        <button onClick={skipForward}>
          <FastForward />
        </button>
      </div>
      <div className={cx(styledVolume, styledRangeInput)}>
        <button className="volume" onClick={() => setMuteVolume((prev) => !prev)}>
          {muteVolume || volume < 1 ? (
            <MuteVolume />
          ) : volume < 33 ? (
            <LowVolume />
          ) : volume < 66 ? (
            <MedVolume />
          ) : (
            <HighVolume />
          )}
        </button>
        <input
          type="range"
          min={0}
          max={100}
          value={volume}
          onChange={(e) => setVolume(Number(e.target.value))}
          className={css`
            background: linear-gradient(
              to right,
              #767b85 ${volume}%,
              #dddee0 ${volume}%
            ) !important;
          `}
        />
      </div>
    </div>
  )
}

export default Controls

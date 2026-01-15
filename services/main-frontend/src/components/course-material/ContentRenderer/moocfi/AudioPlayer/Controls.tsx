"use client"

import { css, cx } from "@emotion/css"
import { RefObject, useCallback, useEffect, useRef, useState } from "react"
import { useButton, useFocusRing } from "react-aria"
import { useTranslation } from "react-i18next"

import { styledRangeInput } from "./RangeComponentStyle"

import FastForward from "@/img/course-material/audio-player/fast-forward.svg"
import HighVolume from "@/img/course-material/audio-player/high-volume.svg"
import LowVolume from "@/img/course-material/audio-player/low-volume.svg"
import MedVolume from "@/img/course-material/audio-player/med-volume.svg"
import MuteVolume from "@/img/course-material/audio-player/mute-volume.svg"
import Pause from "@/img/course-material/audio-player/pause.svg"
import Play from "@/img/course-material/audio-player/play.svg"
import Rewind from "@/img/course-material/audio-player/rewind.svg"

// icons

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
  audioRef: RefObject<HTMLAudioElement | null>
  progressBarRef: RefObject<HTMLInputElement | null>
  duration: number
  setTimeProgress: (T: number) => void
  playPauseButtonRef?: RefObject<HTMLButtonElement | null>
}

const Controls = ({
  audioRef,
  progressBarRef,
  duration,
  setTimeProgress,
  playPauseButtonRef,
}: ControlsProps) => {
  const { t } = useTranslation()
  const [isPlaying, setIsPlaying] = useState<boolean>(false)
  const [volume, setVolume] = useState<number>(60)
  const [muteVolume, setMuteVolume] = useState<boolean>(false)

  const rewindButtonRef = useRef<HTMLButtonElement | null>(null)
  const fastForwardButtonRef = useRef<HTMLButtonElement | null>(null)
  const muteButtonRef = useRef<HTMLButtonElement | null>(null)
  const fallbackPlayPauseRef = useRef<HTMLButtonElement | null>(null)
  const actualPlayPauseRef = playPauseButtonRef || fallbackPlayPauseRef

  const { buttonProps: playPauseButtonProps } = useButton(
    {
      onPress: () => setIsPlaying((prev) => !prev),
      "aria-label": isPlaying ? t("audio-player-pause") : t("audio-player-play"),
    },
    actualPlayPauseRef,
  )
  const { focusProps: playPauseFocusProps, isFocusVisible: isPlayPauseFocusVisible } =
    useFocusRing()

  const { buttonProps: rewindButtonProps } = useButton(
    {
      onPress: () => {
        if (audioRef?.current) {
          audioRef.current.currentTime -= 15
        }
      },
      "aria-label": t("audio-player-rewind"),
    },
    rewindButtonRef,
  )
  const { focusProps: rewindFocusProps, isFocusVisible: isRewindFocusVisible } = useFocusRing()

  const { buttonProps: fastForwardButtonProps } = useButton(
    {
      onPress: () => {
        if (audioRef?.current) {
          audioRef.current.currentTime += 15
        }
      },
      "aria-label": t("audio-player-fast-forward"),
    },
    fastForwardButtonRef,
  )
  const { focusProps: fastForwardFocusProps, isFocusVisible: isFastForwardFocusVisible } =
    useFocusRing()

  const { buttonProps: muteButtonProps } = useButton(
    {
      onPress: () => setMuteVolume((prev) => !prev),
      "aria-label": muteVolume ? t("audio-player-unmute") : t("audio-player-mute"),
    },
    muteButtonRef,
  )
  const { focusProps: muteFocusProps, isFocusVisible: isMuteFocusVisible } = useFocusRing()

  const playAnimationRef = useRef(0)

  const repeat = useCallback(() => {
    if (progressBarRef?.current && audioRef?.current) {
      const currentTime = audioRef.current.currentTime
      progressBarRef.current.value = String(currentTime)
      progressBarRef.current.style.setProperty(
        // eslint-disable-next-line i18next/no-literal-string
        "--range-progress",
        `${(Number(progressBarRef.current.value) / duration) * 100}%`,
      )
      if (currentTime) {
        setTimeProgress(currentTime)
      }

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
        role="toolbar"
        aria-label={t("audio-player-dialog-label")}
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
        <button
          {...rewindButtonProps}
          {...rewindFocusProps}
          ref={rewindButtonRef}
          className={css`
            ${isRewindFocusVisible &&
            css`
              outline: 2px solid #4a90e2;
              outline-offset: 2px;
            `}
          `}
        >
          <Rewind aria-hidden="true" />
        </button>

        <button
          {...playPauseButtonProps}
          {...playPauseFocusProps}
          ref={actualPlayPauseRef}
          aria-label={isPlaying ? t("audio-player-pause") : t("audio-player-play")}
          className={css`
            ${isPlayPauseFocusVisible &&
            css`
              outline: 2px solid #4a90e2;
              outline-offset: 2px;
            `}
          `}
        >
          {isPlaying ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
        </button>
        <button
          {...fastForwardButtonProps}
          {...fastForwardFocusProps}
          ref={fastForwardButtonRef}
          className={css`
            ${isFastForwardFocusVisible &&
            css`
              outline: 2px solid #4a90e2;
              outline-offset: 2px;
            `}
          `}
        >
          <FastForward aria-hidden="true" />
        </button>
      </div>
      <div className={cx(styledVolume, styledRangeInput)}>
        <button
          {...muteButtonProps}
          {...muteFocusProps}
          ref={muteButtonRef}
          aria-label={muteVolume ? t("audio-player-unmute") : t("audio-player-mute")}
          className={css`
            ${isMuteFocusVisible &&
            css`
              outline: 2px solid #4a90e2;
              outline-offset: 2px;
            `}
          `}
        >
          {muteVolume || volume < 1 ? (
            <MuteVolume aria-hidden="true" />
          ) : volume < 33 ? (
            <LowVolume aria-hidden="true" />
          ) : volume < 66 ? (
            <MedVolume aria-hidden="true" />
          ) : (
            <HighVolume aria-hidden="true" />
          )}
        </button>
        <input
          type="range"
          min={0}
          max={100}
          value={volume}
          onChange={(e) => setVolume(Number(e.target.value))}
          aria-label={t("audio-player-volume")}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={volume}
          aria-valuetext={`${volume}%`}
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

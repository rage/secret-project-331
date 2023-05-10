import { css } from "@emotion/css"
import React, { useRef, useState } from "react"

import { respondToOrLarger } from "../../../../shared-module/styles/respond"
import { AudioFile } from "../../../Page"

import CloseIcon from "./../../../../img/close.svg"
import Controls from "./Controls"
import DisplayTrack from "./DisplayTrack"
import ProgressBar from "./ProgressBar"

export interface AudioFileProps {
  tracks: AudioFile[]
  isVisible: boolean
  setIsVisible: () => void
}
export type AudioPlayerProps = React.HTMLAttributes<HTMLDivElement> & AudioFileProps

const AudioPlayer: React.FC<React.PropsWithChildren<React.PropsWithChildren<AudioPlayerProps>>> = ({
  tracks,
  isVisible,
  setIsVisible,
}) => {
  const [timeProgress, setTimeProgress] = useState<number>(0)
  const [duration, setDuration] = useState<number>(0)

  // reference
  const audioRef = useRef<HTMLDivElement>(null)
  const progressBarRef = useRef<HTMLInputElement>(null)

  return (
    <>
      {tracks && isVisible && (
        <div
          className={css`
            position: fixed;
            display: flex;
            bottom: 40px;
            margin: auto;
            left: 0;
            right: 0;
            width: 600px;
            z-index: 99;
          `}
        >
          <div
            className={css`
              width: 100vw;
              background: #fff;
              position: relative;
              border-radius: 10px;
              padding: 30px 20px;
              box-shadow: 0 2px 5px 1px rgba(64, 60, 67, 0.16);

              ${respondToOrLarger.md} {
                width: 700px;
              }
            `}
          >
            <div
              className={css`
                margin: 0 auto;
              `}
            >
              <DisplayTrack
                {...{
                  tracks,
                  audioRef,
                  setDuration,
                  progressBarRef,
                }}
              />
              <ProgressBar {...{ progressBarRef, audioRef, timeProgress, duration }} />
              <Controls
                {...{
                  audioRef,
                  progressBarRef,
                  duration,
                  setTimeProgress,
                  tracks,
                }}
              />
              <button
                className={css`
                  position: absolute;
                  height: 30px;
                  width: 30px;
                  border: none;
                  border-radius: 100px;
                  right: 10px;
                  top: 8px;
                  display: flex;
                  justify-content: center;
                  align-items: center;
                `}
                onClick={setIsVisible}
              >
                <CloseIcon />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
export default AudioPlayer

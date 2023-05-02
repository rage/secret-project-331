import { css } from "@emotion/css"
import React, { useRef, useState } from "react"

import { AudioFile } from "../../../Page"

import Controls from "./Controls"
import DisplayTrack from "./DisplayTrack"
import ProgressBar from "./ProgressBar"

export interface AudioFileProps {
  tracks: AudioFile[]
}
export type AudioPlayerProps = React.HTMLAttributes<HTMLDivElement> & AudioFileProps

const AudioPlayer: React.FC<React.PropsWithChildren<React.PropsWithChildren<AudioPlayerProps>>> = ({
  tracks,
}) => {
  const [timeProgress, setTimeProgress] = useState<number>(0)
  const [duration, setDuration] = useState<number>(0)

  // reference
  const audioRef = useRef()
  const progressBarRef = useRef()

  return (
    <>
      {tracks && (
        <div>
          <div
            className={css`
              background: #ecf0fa;
              padding: 30px 20px;
            `}
          >
            <div
              className={css`
                max-width: 1200px;
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
            </div>
          </div>
        </div>
      )}
    </>
  )
}
export default AudioPlayer

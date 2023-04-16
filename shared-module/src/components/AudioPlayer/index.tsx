import { css } from "@emotion/css"
import React, { useRef, useState } from "react"

// import components
import Controls from "./Controls"
import DisplayTrack from "./DisplayTrack"
import ProgressBar from "./ProgressBar"
import { tracks } from "./data/tracks"

export type AudioPlayerProps = React.HTMLAttributes<HTMLDivElement>

export interface Track {
  title: string
  src?: { mp3: string; ogg: string }
  author?: string
}

const AudioPlayer: React.FC<
  React.PropsWithChildren<React.PropsWithChildren<AudioPlayerProps>>
> = () => {
  // states
  const [trackIndex, setTrackIndex] = useState<number>(0)
  const [currentTrack, setCurrentTrack] = useState<Track>(tracks[trackIndex])
  const [timeProgress, setTimeProgress] = useState<number>(0)
  const [duration, setDuration] = useState<number>(0)

  // reference
  const audioRef = useRef()
  const progressBarRef = useRef()

  return (
    <>
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
              currentTrack,
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
              trackIndex,
              setTrackIndex,
              setCurrentTrack,
            }}
          />
        </div>
      </div>
    </>
  )
}
export default AudioPlayer

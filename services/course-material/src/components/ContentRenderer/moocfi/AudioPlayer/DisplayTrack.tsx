import { css } from "@emotion/css"
import { useRouter } from "next/router"
import React, { forwardRef, Ref, RefObject } from "react"

import { headingFont } from "../../../../shared-module/styles"
import { AudioFile } from "../../../Page"

interface DisplayTrackProps {
  tracks: AudioFile[]
  audioRef: RefObject<HTMLAudioElement> | null
  setDuration: (T: number) => void
  progressBarRef: RefObject<HTMLInputElement> | null
}

const DisplayTrack = ({ tracks, audioRef, setDuration, progressBarRef }: DisplayTrackProps) => {
  const onLoadedMetadata = () => {
    if (audioRef?.current && progressBarRef?.current) {
      const seconds = audioRef?.current?.duration
      seconds && setDuration(seconds)
      progressBarRef.current.max = String(seconds)
    }
  }

  const router = useRouter()

  const title = router.asPath.split("/")[5]
  let formattedTitle = title.charAt(0).toUpperCase() + title.slice(1)
  formattedTitle = formattedTitle.replace(/-/g, " ")

  return (
    <>
      <div>
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <audio ref={audioRef} onLoadedMetadata={onLoadedMetadata}>
          {tracks.map(({ path, mime }: AudioFile) => (
            <source key={path} src={path} type={mime} />
          ))}
        </audio>
        <div
          className={css`
            display: flex;
            gap: 20px;
            justify-content: center;
            text-align: center;
          `}
        >
          <div>
            <p
              className={css`
                color: #313947;
                font-size: 18px;
                margin-bottom: 0;
                padding: 2px;
                font-family: ${headingFont};
                line-height: 1.2;
                font-weight: 500;
                width: 300px;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
              `}
            >
              {formattedTitle}
            </p>
          </div>
        </div>
      </div>
    </>
  )
}
export default DisplayTrack

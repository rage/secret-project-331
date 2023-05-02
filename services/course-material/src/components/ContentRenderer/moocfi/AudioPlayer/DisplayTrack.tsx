import { css } from "@emotion/css"
import { useRouter } from "next/router"
import React from "react"

import { headingFont } from "../../../../shared-module/styles"
import { AudioFile } from "../../../Page"

const DisplayTrack = ({ tracks, audioRef, setDuration, progressBarRef }: any) => {
  const onLoadedMetadata = () => {
    const seconds = audioRef.current.duration
    setDuration(seconds)
    progressBarRef.current.max = seconds
  }

  const router = useRouter()

  const title = router.asPath.split("/")[5]
  const formattedTitle = title.charAt(0).toUpperCase() + title.slice(1)

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
                color: #687eaf;
                font-size: 18px;
                margin-bottom: 0;
                padding: 2px;
                font-family: ${headingFont};
                line-height: 1.2;
                font-weight: 500;
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

import { css } from "@emotion/css"
import { RefObject, useContext, useMemo } from "react"

import PageContext from "../../../../contexts/PageContext"
import { AudioFile } from "../../../Page"

import { headingFont } from "@/shared-module/common/styles"

interface DisplayTrackProps {
  tracks: AudioFile[]
  audioRef: RefObject<HTMLAudioElement> | null
  setDuration: (T: number) => void
  progressBarRef: RefObject<HTMLInputElement> | null
}

const DisplayTrack = ({ tracks, audioRef, setDuration, progressBarRef }: DisplayTrackProps) => {
  const pageContext = useContext(PageContext)
  const onLoadedMetadata = () => {
    if (audioRef?.current && progressBarRef?.current) {
      const seconds = audioRef?.current?.duration
      if (seconds) {
        setDuration(seconds)
      }
      progressBarRef.current.max = String(seconds)
    }
  }

  const sortedTracks = useMemo(() => {
    // Sorts mp3 files last, as they're the fallback format
    return tracks.sort((a, b) => {
      if (a.mime === "audio/mpeg") {
        return 1
      } else if (b.mime === "audio/mpeg") {
        return -1
      }
      return 0
    })
  }, [tracks])

  return (
    <>
      <div>
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <audio ref={audioRef} onLoadedMetadata={onLoadedMetadata}>
          {sortedTracks.map(({ path, mime }: AudioFile) => (
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
                color: #24053b;
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
              {pageContext.pageData?.title}
            </p>
          </div>
        </div>
      </div>
    </>
  )
}
export default DisplayTrack

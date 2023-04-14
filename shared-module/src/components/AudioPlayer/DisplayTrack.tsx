import { css } from "@emotion/css"

import { headingFont } from "../../styles"

const DisplayTrack = ({ currentTrack, audioRef, setDuration, progressBarRef }: any) => {
  const onLoadedMetadata = () => {
    const seconds = audioRef.current.duration
    setDuration(seconds)
    progressBarRef.current.max = seconds
  }

  return (
    <div>
      <audio ref={audioRef} onLoadedMetadata={onLoadedMetadata}>
        <source src={currentTrack.src.mp3} type="audio/mp3" />
        <source src={currentTrack.src.ogg} type="audio/ogg" />
        <track kind="subtitles" srcLang="en" label="English" />
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
            {currentTrack.title}
          </p>
        </div>
      </div>
    </div>
  )
}
export default DisplayTrack

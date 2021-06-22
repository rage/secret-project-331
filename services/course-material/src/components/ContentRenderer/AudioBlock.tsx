import { css } from "@emotion/css"
import { BlockRendererProps } from "."
import { normalWidthCenteredComponentStyles } from "../../styles/componentStyles"
import { AudioAttributes } from "../../types/GutenbergBlockAttributes"

const AudioBlock: React.FC<BlockRendererProps<AudioAttributes>> = ({ data }) => {
  const attributes: AudioAttributes = data.attributes
  return (
    <figure
      className={css`
        ${normalWidthCenteredComponentStyles}
      `}
    >
      <audio controls>
        <source
          src={attributes.src}
          className={css`
            ${normalWidthCenteredComponentStyles}
          `}
        />
      </audio>
      <figcaption>{attributes.caption}</figcaption>
    </figure>
  )
}

export default AudioBlock

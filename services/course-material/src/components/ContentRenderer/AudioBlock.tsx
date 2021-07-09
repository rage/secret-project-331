import { css } from "@emotion/css"

import { normalWidthCenteredComponentStyles } from "../../styles/componentStyles"

import { BlockRendererProps } from "."

interface AudioBlockAttributes {
  src: string
  caption: string
}

const AudioBlock: React.FC<BlockRendererProps<AudioBlockAttributes>> = ({ data }) => {
  const attributes: AudioBlockAttributes = data.attributes
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

import { css } from "@emotion/css"
import React from "react"

import { courseMaterialCenteredComponentStyles } from "../../shared-module/styles/componentStyles"
import { EmbedAttributes } from "../../types/GutenbergBlockAttributes"

import { BlockRendererProps } from "."

const YoutubeEmbddedBlock: React.FC<EmbedAttributes> = (props) => {
  const { url } = props
  const video = url?.split("v=")[1]

  return (
    <iframe
      src={`https://www.youtube.com/embed/${video}`}
      title="YouTube video player"
      frameBorder="0"
      allowFullScreen
      className={css`
        display: block;
        width: 768px;
        height: 576px;
      `}
    ></iframe>
  )
}

const EmbedBlock: React.FC<BlockRendererProps<EmbedAttributes>> = (props) => {
  const { data } = props
  const type = data.attributes.providerNameSlug

  return (
    <div className={courseMaterialCenteredComponentStyles}>
      {type === "youtube" && <YoutubeEmbddedBlock {...props.data.attributes} />}
    </div>
  )
}

export default EmbedBlock

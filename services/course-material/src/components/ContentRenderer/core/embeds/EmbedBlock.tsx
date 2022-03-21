import React from "react"

import { BlockRendererProps } from "../.."
import { EmbedAttributes } from "../../../../../types/GutenbergBlockAttributes"

import { SpotifyEmbedBlock } from "./variants/SpotifyEmbedBlock"
import { TwitterEmbedBlock } from "./variants/TwitterEmbedBlock"
import { VimeoEmbedBlock } from "./variants/VimeoEmbedBlock"
import { YoutubeEmbedBlock } from "./variants/YoutubeEmbedBlock"

const EmbedBlock: React.FC<BlockRendererProps<EmbedAttributes>> = (props) => {
  const { data } = props
  const type = data.attributes.providerNameSlug

  return (
    <div>
      {type === "youtube" && <YoutubeEmbedBlock {...props.data.attributes} />}
      {type === "twitter" && <TwitterEmbedBlock {...props.data.attributes} />}
      {type === "spotify" && <SpotifyEmbedBlock {...props.data.attributes} />}
      {type === "vimeo" && <VimeoEmbedBlock {...props.data.attributes} />}
    </div>
  )
}

export default EmbedBlock

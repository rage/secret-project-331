import React from "react"

import { BlockRendererProps } from "../.."
import { EmbedAttributes } from "../../../../../types/GutenbergBlockAttributes"

import { MentimeterEmbedBlock } from "./variants/MentimeterEmbedBlock"
import { SpotifyEmbedBlock } from "./variants/SpotifyEmbedBlock"
import { ThingLinkEmbedBlock } from "./variants/ThingLinkEmbedBlock"
import { TwitterEmbedBlock } from "./variants/TwitterEmbedBlock"
import { VimeoEmbedBlock } from "./variants/VimeoEmbedBlock"
import { YoutubeEmbedBlock } from "./variants/YoutubeEmbedBlock"

import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

const EmbedBlock: React.FC<React.PropsWithChildren<BlockRendererProps<EmbedAttributes>>> = (
  props,
) => {
  const { data } = props
  const type = data.attributes.providerNameSlug

  return (
    <div>
      {type === "youtube" && (
        <YoutubeEmbedBlock
          dontAllowBlockToBeWiderThanContainerWidth={
            props.dontAllowBlockToBeWiderThanContainerWidth ?? false
          }
          {...props.data.attributes}
        />
      )}
      {type === "twitter" && <TwitterEmbedBlock {...props.data.attributes} />}
      {type === "spotify" && <SpotifyEmbedBlock {...props.data.attributes} />}
      {type === "vimeo" && (
        <VimeoEmbedBlock
          dontAllowBlockToBeWiderThanContainerWidth={
            props.dontAllowBlockToBeWiderThanContainerWidth ?? false
          }
          {...props.data.attributes}
        />
      )}
      {type === "mentimeter" && <MentimeterEmbedBlock {...props.data.attributes} />}
      {type === "thinglink" && (
        <ThingLinkEmbedBlock
          dontAllowBlockToBeWiderThanContainerWidth={
            props.dontAllowBlockToBeWiderThanContainerWidth ?? false
          }
          {...props.data.attributes}
        />
      )}
    </div>
  )
}

export default withErrorBoundary(EmbedBlock)

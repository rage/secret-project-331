import { css } from "@emotion/css"
import React from "react"

import { courseMaterialCenteredComponentStyles } from "../../shared-module/styles/componentStyles"
import { EmbedAttributes } from "../../types/GutenbergBlockAttributes"

import { BlockRendererProps } from "."

const YoutubeEmbeddedBlock: React.FC<EmbedAttributes> = (props) => {
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

const SpotifyEmbeddedBlock: React.FC<EmbedAttributes> = (props) => {
  const content = props.url.split("/")
  const type = content[content.length - 2]
  const spotifyId = content[content.length - 1]

  return (
    <iframe
      src={`https://open.spotify.com/embed/${type}/${spotifyId}`}
      frameBorder="0"
      title="Spotify"
      allowTransparency={true}
      allow="encrypted-media"
      className={css`
        display: block;
        width: 768px;
        height: 576px;
      `}
    ></iframe>
  )
}

const TwitterEmbeddedBlock: React.FC<EmbedAttributes> = (props) => {
  const blob = new Blob(
    [
      `
      <blockquote class="twitter-tweet">
        <a href="${props.url}">Tweet</a>
      </blockquote>
      <script async src="https://platform.twitter.com/widgets.js" charset="utf-8"></script>
      `,
    ],
    { type: "text/html" },
  )

  return (
    <iframe
      src={window.URL.createObjectURL(blob)}
      title="Tweet"
      frameBorder="0"
      className={css`
        display: block;
        width: 768px;
        height: 576px;
      `}
    />
  )
}

const EmbedBlock: React.FC<BlockRendererProps<EmbedAttributes>> = (props) => {
  const { data } = props
  const type = data.attributes.providerNameSlug

  return (
    <div className={courseMaterialCenteredComponentStyles}>
      {type === "youtube" && <YoutubeEmbeddedBlock {...props.data.attributes} />}
      {type === "twitter" && <TwitterEmbeddedBlock {...props.data.attributes} />}
      {type === "spotify" && <SpotifyEmbeddedBlock {...props.data.attributes} />}
    </div>
  )
}

export default EmbedBlock

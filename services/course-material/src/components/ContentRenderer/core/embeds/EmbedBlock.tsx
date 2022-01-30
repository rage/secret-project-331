import { css } from "@emotion/css"
import React from "react"
import { useTranslation } from "react-i18next"

import { BlockRendererProps } from "../.."
import { EmbedAttributes } from "../../../../../types/GutenbergBlockAttributes"

const YoutubeEmbeddedBlock: React.FC<EmbedAttributes> = (props) => {
  const { t } = useTranslation()
  const { url } = props
  const video = url?.split("v=")[1]

  return (
    <iframe
      src={`https://www.youtube.com/embed/${video}`}
      title={t("title-youtube-video-player")}
      sandbox="allow-scripts allow-same-origin"
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
  const url = props.url ?? ""
  const content = url.split("/")
  const type = content[content.length - 2]
  const spotifyId = content[content.length - 1]

  return (
    <iframe
      src={`https://open.spotify.com/embed/${type}/${spotifyId}`}
      frameBorder="0"
      title="Spotify"
      sandbox="allow-scripts allow-same-origin"
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
      // eslint-disable-next-line i18next/no-literal-string
      `
      <blockquote class="twitter-tweet">
        <a href="${props.url}">Tweet</a>
      </blockquote>
      <script async src="https://platform.twitter.com/widgets.js" charset="utf-8"></script>
      `,
    ],
    // eslint-disable-next-line i18next/no-literal-string
    { type: "text/html" },
  )

  return (
    <iframe
      src={window.URL.createObjectURL(blob)}
      title="Tweet"
      sandbox="allow-scripts allow-same-origin"
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
    <div>
      {type === "youtube" && <YoutubeEmbeddedBlock {...props.data.attributes} />}
      {type === "twitter" && <TwitterEmbeddedBlock {...props.data.attributes} />}
      {type === "spotify" && <SpotifyEmbeddedBlock {...props.data.attributes} />}
    </div>
  )
}

export default EmbedBlock

import { css } from "@emotion/css"
import React from "react"
import { useTranslation } from "react-i18next"

import { BlockRendererProps } from "../.."
import { EmbedAttributes } from "../../../../../types/GutenbergBlockAttributes"
import BreakFromCentered from "../../../../shared-module/components/Centering/BreakFromCentered"
import aspectRatioFromClassName from "../../../../utils/aspectRatioFromClassName"

const YoutubeEmbeddedBlock: React.FC<EmbedAttributes> = (props) => {
  const { t } = useTranslation()
  const { url } = props
  let video = url?.split("v=")[1]
  if (url) {
    try {
      const parsedUrl = new URL(url)
      const vValue = parsedUrl.searchParams.get("v")
      if (vValue) {
        video = vValue
      }
    } catch (e) {
      // eslint-disable-next-line i18next/no-literal-string
      console.error(`Could not parse Youtube url: `, e)
    }
  }

  return (
    <BreakFromCentered sidebar={false}>
      <div
        className={css`
          width: 100%;
          max-width: 1000px;
          margin: 0 auto;
        `}
      >
        <iframe
          className={css`
            display: block;
            width: 100%;
            aspect-ratio: ${aspectRatioFromClassName(props.className)};
            margin: 4rem 0;
          `}
          src={`https://www.youtube-nocookie.com/embed/${video}`}
          title={t("title-youtube-video-player")}
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        ></iframe>
      </div>
    </BreakFromCentered>
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

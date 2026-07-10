"use client"

import { css } from "@emotion/css"

import { EmbedAttributes } from "@/../types/GutenbergBlockAttributes"

export const SpotifyEmbedBlock: React.FC<React.PropsWithChildren<EmbedAttributes>> = (props) => {
  const url = props.url ?? ""
  const content = url ? url.split("/") : []
  const type = content.length >= 2 ? content[content.length - 2] : ""
  const spotifyId = content.length >= 1 ? content[content.length - 1] : ""

  return (
    <iframe
      src={`https://open.spotify.com/embed/${type}/${spotifyId}`}
      frameBorder="0"
      // oxlint-disable-next-line i18next/no-literal-string
      title="Spotify"
      // Cross-origin Spotify player; both flags are required and the frame runs under open.spotify.com, not our origin.
      // oxlint-disable-next-line react/iframe-missing-sandbox
      sandbox="allow-scripts allow-same-origin"
      allow="encrypted-media"
      className={css`
        display: block;
        width: 100%;
        max-width: 768px;
        height: 352px;
        border-radius: 4px;
        margin: 1rem 0;
      `}
    ></iframe>
  )
}

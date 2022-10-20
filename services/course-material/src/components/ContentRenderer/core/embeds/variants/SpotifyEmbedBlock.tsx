import { css } from "@emotion/css"

import { EmbedAttributes } from "../../../../../../types/GutenbergBlockAttributes"

export const SpotifyEmbedBlock: React.FC<React.PropsWithChildren<EmbedAttributes>> = (props) => {
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
      allow="encrypted-media"
      className={css`
        display: block;
        width: 768px;
        height: 576px;
        border-radius: 4px;
        margin: 1rem 0;
      `}
    ></iframe>
  )
}

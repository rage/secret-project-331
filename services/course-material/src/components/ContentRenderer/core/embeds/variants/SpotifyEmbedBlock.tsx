import { css } from "@emotion/css"

import { EmbedAttributes } from "../../../../../../types/GutenbergBlockAttributes"

export const SpotifyEmbedBlock: React.FC<EmbedAttributes> = (props) => {
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

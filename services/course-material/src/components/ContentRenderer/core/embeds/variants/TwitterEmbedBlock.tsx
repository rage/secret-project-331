import { css } from "@emotion/css"

import { EmbedAttributes } from "../../../../../../types/GutenbergBlockAttributes"

export const TwitterEmbedBlock: React.FC<React.PropsWithChildren<EmbedAttributes>> = (props) => {
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

    { type: "text/html" },
  )

  return (
    <iframe
      src={window.URL.createObjectURL(blob)}
      // eslint-disable-next-line i18next/no-literal-string
      title={"Twitter"}
      sandbox="allow-scripts allow-same-origin"
      frameBorder="0"
      className={css`
        display: block;
        width: 602px;
        height: 737px;
        margin: 1rem auto;
      `}
    />
  )
}

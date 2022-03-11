import { css } from "@emotion/css"

import { EmbedAttributes } from "../../../../../../types/GutenbergBlockAttributes"

export const TwitterEmbedBlock: React.FC<EmbedAttributes> = (props) => {
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

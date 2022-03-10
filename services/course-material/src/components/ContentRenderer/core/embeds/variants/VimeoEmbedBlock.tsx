import { css } from "@emotion/css"
import axios from "axios"
import { useEffect, useState } from "react"

import { EmbedAttributes } from "../../../../../../types/GutenbergBlockAttributes"
import BreakFromCentered from "../../../../../shared-module/components/Centering/BreakFromCentered"
import ErrorBanner from "../../../../../shared-module/components/ErrorBanner"
import aspectRatioFromClassName from "../../../../../utils/aspectRatioFromClassName"

export const VimeoEmbedBlock: React.FC<EmbedAttributes> = (props) => {
  const [embedHtml, setEmbedHtml] = useState(null)
  useEffect(() => {
    const fetchEmbed = async () => {
      if (props.url) {
        const response = await axios.get(
          `/oembed/1.0/proxy?url=${encodeURIComponent(props.url)}&_locale=user`,
        )
        const data = await response.data
        if (data.html) {
          setEmbedHtml(data.html)
        }
      }
    }
    fetchEmbed()
  })

  return (
    <>
      {embedHtml ? (
        <BreakFromCentered sidebar={false}>
          <div
            className={css`
              iframe {
                display: block;
                width: 100%;
                aspect-ratio: ${aspectRatioFromClassName(props.className)};
                margin: 4rem 0;
              }
            `}
            dangerouslySetInnerHTML={{
              __html: embedHtml,
            }}
          ></div>
        </BreakFromCentered>
      ) : (
        <ErrorBanner
          variant="readOnly"
          // eslint-disable-next-line i18next/no-literal-string
          error={`Could not fetch VIMEO oEmbed with url: ${props.url}`}
        />
      )}
    </>
  )
}

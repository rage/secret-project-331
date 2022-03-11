import { css } from "@emotion/css"
import axios from "axios"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

import { EmbedAttributes } from "../../../../../../types/GutenbergBlockAttributes"
import BreakFromCentered from "../../../../../shared-module/components/Centering/BreakFromCentered"
import ErrorBanner from "../../../../../shared-module/components/ErrorBanner"
import Spinner from "../../../../../shared-module/components/Spinner"
import aspectRatioFromClassName from "../../../../../utils/aspectRatioFromClassName"

export const VimeoEmbedBlock: React.FC<EmbedAttributes> = (props) => {
  const [embedHtml, setEmbedHtml] = useState(undefined)
  const [fetching, setFetching] = useState(true)
  const { t } = useTranslation()
  useEffect(() => {
    const fetchEmbed = async () => {
      if (props.url) {
        // maxWidth and maxHeight same as backend url_to_oembed_endpoint.rs
        const response = await axios.get(
          `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(
            props.url,
          )}&maxwidth=780&maxheight=440`,
        )
        const data = await response.data
        if (data.html) {
          setEmbedHtml(data.html)
        }
      }
      setFetching(false)
    }
    fetchEmbed()
  })

  return (
    <>
      {fetching && <Spinner variant="medium" />}
      {embedHtml && !fetching && (
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
      )}
      {!embedHtml && !fetching && (
        <ErrorBanner
          variant="readOnly"
          error={t("could-not-fetch-embed", {
            provider: props.providerNameSlug,
            url: props.url ?? "undefined",
          })}
        />
      )}
    </>
  )
}

import { css } from "@emotion/css"
import axios from "axios"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

import { EmbedAttributes } from "../../../../../../types/GutenbergBlockAttributes"
import aspectRatioFromClassName from "../../../../../utils/aspectRatioFromClassName"
import { sanitizeCourseMaterialHtml } from "../../../../../utils/sanitizeCourseMaterialHtml"

import BreakFromCentered from "@/shared-module/common/components/Centering/BreakFromCentered"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import Spinner from "@/shared-module/common/components/Spinner"
import { baseTheme } from "@/shared-module/common/styles/theme"

const VIMEO_MAX_WIDTH = 780

export const VimeoEmbedBlock: React.FC<
  React.PropsWithChildren<EmbedAttributes & { className?: string }>
> = (props) => {
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
          )}&maxwidth=${VIMEO_MAX_WIDTH}&maxheight=440`,
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
          <figure
            className={css`
              width: 100%;
              max-width: ${VIMEO_MAX_WIDTH}px;
              margin: 4rem auto;
            `}
          >
            <div
              className={css`
                iframe {
                  display: block;
                  width: 100%;
                  aspect-ratio: ${aspectRatioFromClassName(props.className)};
                }
              `}
              dangerouslySetInnerHTML={{
                __html: embedHtml,
              }}
            ></div>
            <figcaption
              className={css`
                text-align: center;
                font-size: ${baseTheme.fontSizes[0]}px;
                margin-top: 0.5em;
                margin-bottom: 1em;
                color: ${baseTheme.colors.gray[400]};
              `}
              dangerouslySetInnerHTML={{ __html: sanitizeCourseMaterialHtml(props.caption ?? "") }}
            ></figcaption>
          </figure>
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

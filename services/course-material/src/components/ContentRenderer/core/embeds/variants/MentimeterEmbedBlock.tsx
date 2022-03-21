import { css } from "@emotion/css"
import axios from "axios"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

import { EmbedAttributes } from "../../../../../../types/GutenbergBlockAttributes"
import BreakFromCentered from "../../../../../shared-module/components/Centering/BreakFromCentered"
import ErrorBanner from "../../../../../shared-module/components/ErrorBanner"
import Spinner from "../../../../../shared-module/components/Spinner"
import { baseTheme } from "../../../../../shared-module/styles"

export const MentimeterEmbedBlock: React.FC<EmbedAttributes> = (props) => {
  const [embedHtml, setEmbedHtml] = useState(undefined)
  const [fetching, setFetching] = useState(true)
  const { t } = useTranslation()
  useEffect(() => {
    const fetchEmbed = async () => {
      if (props.url) {
        const response = await axios.get(
          `http://project-331.local/api/v0/cms/gutenberg/oembed/mentimeter?url=${encodeURIComponent(
            props.url,
          )}`,
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
          <figure>
            <div
              className={css`
                iframe {
                  display: block;
                  width: 100%;
                  margin: 2rem 0;
                  border: 0;
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
                color: ${baseTheme.colors.grey[400]};
              `}
            >
              {props.caption}
            </figcaption>
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

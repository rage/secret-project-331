import { css } from "@emotion/css"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

import { EmbedAttributes } from "../../../../../../types/GutenbergBlockAttributes"
import { fetchMentimeterEmbed } from "../../../../../services/backend"
import ErrorBanner from "../../../../../shared-module/components/ErrorBanner"
import Spinner from "../../../../../shared-module/components/Spinner"
import { baseTheme } from "../../../../../shared-module/styles"
import { sanitizeCourseMaterialHtml } from "../../../../../utils/sanitizeCourseMaterialHtml"

export const MentimeterEmbedBlock: React.FC<React.PropsWithChildren<EmbedAttributes>> = (props) => {
  const [embedHtml, setEmbedHtml] = useState<string | undefined>(undefined)
  const [fetching, setFetching] = useState(true)
  const { t } = useTranslation()
  useEffect(() => {
    const fetchEmbed = async () => {
      if (props.url) {
        const response = await fetchMentimeterEmbed(props.url)
        if (response.html) {
          setEmbedHtml(response.html)
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
        <figure
          className={css`
            position: relative;
          `}
        >
          {/* This span is to remove an annoying 2px height from mentimeter. */}
          <span
            className={css`
              position: absolute;
              left: 0;
              top: 0;
              width: 100%;
              border-top: 2px solid white;
            `}
          >
            &nbsp;
          </span>
          <div
            className={css`
              iframe {
                display: block;
                width: 100%;
                margin-bottom: 2rem;
                border: 0;
              }
            `}
            dangerouslySetInnerHTML={{
              __html: sanitizeCourseMaterialHtml(embedHtml, {
                ALLOWED_TAGS: ["iframe"],
              }),
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
            dangerouslySetInnerHTML={{ __html: sanitizeCourseMaterialHtml(props.caption ?? "") }}
          ></figcaption>
        </figure>
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

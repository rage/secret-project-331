import { css } from "@emotion/css"
import { useTranslation } from "react-i18next"

import { EmbedAttributes } from "../../../../../../types/GutenbergBlockAttributes"
import { sanitizeCourseMaterialHtml } from "../../../../../utils/sanitizeCourseMaterialHtml"

import BreakFromCentered from "@/shared-module/common/components/Centering/BreakFromCentered"
import { baseTheme } from "@/shared-module/common/styles/theme"

const THINGLINK = "thinglink"
const GET_NUMERIC_ID_FROM_STRING_REGEX = /\/(\d+)/g

export const ThingLinkEmbedBlock: React.FC<React.PropsWithChildren<EmbedAttributes>> = (props) => {
  const { t } = useTranslation()
  let id: string | null = null

  if (props.url) {
    const groups = props.url.matchAll(GET_NUMERIC_ID_FROM_STRING_REGEX)
    id = groups.next()?.value[1]
  }

  return (
    <BreakFromCentered sidebar={false}>
      <figure
        className={css`
          width: 100%;
          max-width: 1000px;
          margin: 4rem auto;
        `}
      >
        <iframe
          className={css`
            width: 100%;
            height: 630px;
            border: none;
            overflow: hidden;
          `}
          src={props.url}
          allow="fullscreen"
          title={THINGLINK}
          sandbox="allow-scripts allow-same-origin allow-top-navigation-by-user-activation allow-popups allow-popups-to-escape-sandbox"
        ></iframe>

        <figcaption
          className={css`
            text-align: center;
            font-size: ${baseTheme.fontSizes[0]}px;
            margin-top: 0.5em;
            margin-bottom: 1em;
            color: ${baseTheme.colors.gray[400]};
          `}
        >
          {props.caption && (
            <div dangerouslySetInnerHTML={{ __html: sanitizeCourseMaterialHtml(props.caption) }} />
          )}
          {id && (
            <a href={`https://www.thinglink.com/view/scene/${id}/accessibility`}>
              {t("link-text-open-accessible-view-of-this-content")}
            </a>
          )}
        </figcaption>
      </figure>
    </BreakFromCentered>
  )
}

import { css } from "@emotion/css"

import { EmbedAttributes } from "../../../../../../types/GutenbergBlockAttributes"
import { sanitizeCourseMaterialHtml } from "../../../../../utils/sanitizeCourseMaterialHtml"

import BreakFromCentered from "@/shared-module/common/components/Centering/BreakFromCentered"
import { baseTheme } from "@/shared-module/common/styles/theme"

const THINGLINK = "thinglink"

export const ThingLinkEmbedBlock: React.FC<React.PropsWithChildren<EmbedAttributes>> = (props) => {
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
        </figcaption>
      </figure>
    </BreakFromCentered>
  )
}

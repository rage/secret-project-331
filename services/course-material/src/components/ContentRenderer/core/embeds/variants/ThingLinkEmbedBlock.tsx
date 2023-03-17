import { css } from "@emotion/css"

import { EmbedAttributes } from "../../../../../../types/GutenbergBlockAttributes"
import BreakFromCentered from "../../../../../shared-module/components/Centering/BreakFromCentered"
import { baseTheme } from "../../../../../shared-module/styles/theme"
import { sanitizeCourseMaterialHtml } from "../../../../../utils/sanitizeCourseMaterialHtml"

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
          width="960"
          height="630"
          data-original-width="3992"
          data-original-height="2621"
          src="https://www.thinglink.com/card/1205257932048957445"
          frameBorder="0"
          allowFullScreen
          scrolling="no"
          title={THINGLINK}
          sandbox="allow-scripts allow-same-origin allow-top-navigation-by-user-activation"
        ></iframe>
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
  )
}

import { css } from "@emotion/css"

import { defaultContainerWidth, wideContainerWidth } from "./constants"
import { respondToOrLarger } from "./respond"

// Centering is done with this because we don't want to constrict all components
// in a page to be inside a container. Some elements need the entire width
// of the page.

// Use only in CMS
// Sidebar removed at 75rem, sidebar width 280px
// eslint-disable-next-line i18next/no-literal-string
export const normalWidthCenteredComponentStyles = css`
  max-width: ${defaultContainerWidth}rem;
  margin-left: auto;
  margin-right: auto;
  ${respondToOrLarger.xl} {
    margin-right: calc(50% - 280px);
  }
`

// Use only in CMS
// Sidebar removed at 75rem, sidebar width 280px
// eslint-disable-next-line i18next/no-literal-string
export const wideWidthCenteredComponentStyles = css`
  max-width: ${wideContainerWidth}rem;
  margin-left: auto;
  margin-right: auto;
  ${respondToOrLarger.xl} {
    margin-right: calc(50% - 280px);
  }
`

// Use in course-material
// eslint-disable-next-line i18next/no-literal-string
export const courseMaterialCenteredComponentStyles = css`
  max-width: ${defaultContainerWidth}rem;
  margin-left: auto;
  margin-right: auto;
  padding: 0rem 1.375rem;
  margin-bottom: 1.25rem;
  ${respondToOrLarger.md} {
    padding: 0rem;
  }
`

import { css } from "@emotion/css"

import { defaultContainerWidth, wideContainerWidth } from "./constants"
import { respondToOrLarger } from "./respond"

// Centering is done with this because we don't want to constrict all components
// in a page to be inside a container. Some elements need the entire width
// of the page.

// Use in main-frontend
// eslint-disable-next-line i18next/no-literal-string
export const frontendNormalWidthCenteredComponentStyles = css`
  max-width: ${defaultContainerWidth}rem;
  margin-left: auto;
  margin-right: auto;
  padding: 0rem 1.375rem;
  ${respondToOrLarger.xl} {
    padding: 0rem;
  }
`
// Use in main-frontend
// eslint-disable-next-line i18next/no-literal-string
export const frontendWideWidthCenteredComponentStyles = css`
  max-width: ${wideContainerWidth}rem;
  margin-left: auto;
  margin-right: auto;
  padding: 0rem 1.375rem;
  ${respondToOrLarger.xl} {
    padding: 0rem;
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

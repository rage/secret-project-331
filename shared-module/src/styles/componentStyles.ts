import { css } from "@emotion/css"

import { defaultContainerWidth, wideContainerWidth } from "./constants"
import { respondToOrLarger } from "./respond"

// Centering is done with this because we don't want to constrict all components
// in a page to be inside a container. Some elements need the entire width
// of the page.
export const normalWidthCenteredComponentStyles = css`
  width: 100%;
  max-width: ${defaultContainerWidth}rem;
  margin-left: auto;
  margin-right: auto;
`

export const courseMaterialCenteredComponentStyles = css`
  width: 100%;
  max-width: ${defaultContainerWidth}rem;
  margin-left: auto;
  margin-right: auto;
  padding: 0rem 1.375rem;
  margin-bottom: 1.25rem;
  ${respondToOrLarger.lg} {
    padding: 0rem 2.375rem;
  }
`

export const wideWidthCenteredComponentStyles = css`
  max-width: ${wideContainerWidth}rem;
  margin-left: auto;
  margin-right: auto;
`

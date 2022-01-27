import { css } from "@emotion/css"

import { narrowContainerWidthPx, normalContainerWidthRem } from "./constants"
import { respondToOrLarger } from "./respond"

// Centering is done with this because we don't want to constrict all components
// in a page to be inside a container. Some elements need the entire width
// of the page.

// eslint-disable-next-line i18next/no-literal-string
export const wideWidthCenteredComponentStyles = css`
  max-width: ${normalContainerWidthRem}rem;
  margin-left: auto;
  margin-right: auto;
  padding: 0rem 1.375rem;
  margin-bottom: 1.25rem;
  ${respondToOrLarger.xl} {
    padding: 0rem;
  }
`

// eslint-disable-next-line i18next/no-literal-string
export const normalWidthCenteredComponentStyles = css`
  max-width: ${narrowContainerWidthPx}rem;
  margin-left: auto;
  margin-right: auto;
  padding: 0rem 1.375rem;
  margin-bottom: 1.25rem;
  ${respondToOrLarger.md} {
    padding: 0rem;
  }
`

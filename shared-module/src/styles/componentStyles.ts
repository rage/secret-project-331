import { css } from "@emotion/css"

import { defaultContainerWidth } from "./constants"

// Centering is done with this because we don't want to constrict all components
// in a page to be inside a container. Some elements need the entire width
// of the page.
export const normalWidthCenteredComponentStyles = css`
  max-width: ${defaultContainerWidth}px;
  margin-left: auto;
  margin-right: auto;
`

export const chapterBox = css`
  background-color: #e0e0e0;
  display: flex;
  margin-bottom: 1rem;
`

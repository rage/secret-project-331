import { css } from "@emotion/css";

// Centering is done with this because we don't want to constrict all components
// in a page to be inside a container. Some elements need the entire width
// of the page.
export const normalWidthCenteredComponentStyles = css`
  width: 100%;
  max-width: 900px;
  margin-left: auto;
  margin-right: auto;
`

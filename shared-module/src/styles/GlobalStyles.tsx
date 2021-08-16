import { css, injectGlobal } from "@emotion/css"

import { headingFont, primaryFont } from "../utils"

import cssReset from "./cssReset"

import "@fontsource/josefin-sans"
import "@fontsource/lato"

// Using this instead of directly injectGlobal because stylelint works in this one.
const globalCss = css`
  ${cssReset}

  html, body {
    font-family: ${primaryFont};
  }
  h1,
  h2,
  h3,
  h4,
  h5,
  h6 {
    font-family: ${headingFont};
  }
`

injectGlobal`
${globalCss}
`

const GlobalStyles: React.FC = () => null

export default GlobalStyles

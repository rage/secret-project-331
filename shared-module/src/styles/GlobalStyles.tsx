import { css, injectGlobal } from "@emotion/css"

import { primaryFont } from "../utils"

import cssReset from "./cssReset"

import "@fontsource/josefin-sans"
import "@fontsource/lato"

// Using this instead of direcrly injectGlobal because stylelint works in this one.
const globalCss = css`
  ${cssReset}

  html, body {
    font-family: ${primaryFont};
  }
`

injectGlobal`
${globalCss}
`

const GlobalStyles: React.FC = () => null

export default GlobalStyles

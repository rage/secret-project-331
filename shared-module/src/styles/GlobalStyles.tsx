import { css, injectGlobal } from "@emotion/css"

import cssReset from "./cssReset"

import { headingFont, monospaceFont, primaryFont, typography } from "."

import "@fontsource/josefin-sans"
import "@fontsource/lato"
import "@fontsource/space-mono"

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
  h1 {
    font-size: ${typography.h1};
  }
  h2 {
    font-size: ${typography.h2};
  }
  h3 {
    font-size: ${typography.h3};
  }
  h4 {
    font-size: ${typography.h4};
  }
  h5 {
    font-size: ${typography.h5};
  }
  h6 {
    font-size: ${typography.h6};
  }
  pre,
  tt {
    font-family: ${monospaceFont};
  }
`

injectGlobal`
${globalCss}
`

const GlobalStyles: React.FC = () => null

export default GlobalStyles

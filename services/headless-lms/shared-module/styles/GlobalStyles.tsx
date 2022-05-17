/* eslint-disable i18next/no-literal-string */
import { css, injectGlobal } from "@emotion/css"

import { defaultFontSizePx, linkWithExtraIconClass } from "./constants"
import cssReset from "./cssReset"

import { headingFont, monospaceFont, primaryFont, typography } from "."

import "@fontsource/josefin-sans"
import "@fontsource/josefin-sans/100.css"
import "@fontsource/josefin-sans/200.css"
import "@fontsource/josefin-sans/300.css"
import "@fontsource/josefin-sans/400.css"
import "@fontsource/lato"
import "@fontsource/space-mono"

// Using this instead of directly injectGlobal because stylelint works in this one.
const globalCss = css`
  ${cssReset}

  html, body {
    font-family: ${primaryFont};
    font-size: ${defaultFontSizePx}px;
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
    font-size: ${typography.h3};
  }
  h2 {
    font-size: ${typography.h4};
  }
  h3 {
    font-size: ${typography.h5};
  }
  h4 {
    font-size: ${typography.h6};
  }
  h5 {
    font-size: ${typography.h6};
  }
  h6 {
    font-size: ${typography.h6};
  }
  pre,
  code,
  kbd,
  tt {
    font-family: ${monospaceFont};
  }
  .screen-reader-only {
    position: absolute;
    width: 1px;
    clip: rect(0 0 0 0);
    overflow: hidden;
    white-space: nowrap;
  }
  .${linkWithExtraIconClass} {
    display: inline-flex;
    align-items: center;
    margin-right: 0.1rem;

    svg {
      margin-left: 0.1rem;
      position: relative;
      top: 1px;
    }
  }
`

injectGlobal`
${globalCss}
`

const GlobalStyles: React.FC = () => null

export default GlobalStyles

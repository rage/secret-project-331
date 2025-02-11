import { css, injectGlobal } from "@emotion/css"

import { defaultFontSizePx, linkWithExtraIconClass } from "./constants"
import cssReset from "./cssReset"

import { headingFont, monospaceFont, primaryFont, typography } from "."

import "@fontsource/raleway/100.css"
import "@fontsource/raleway/200.css"
import "@fontsource/raleway/300.css"
import "@fontsource/raleway/400.css"
import "@fontsource/raleway/500.css"
import "@fontsource/raleway/600.css"
import "@fontsource/raleway/700.css"
import "@fontsource/raleway/800.css"
import "@fontsource/josefin-sans"
import "@fontsource/josefin-sans/100.css"
import "@fontsource/josefin-sans/200.css"
import "@fontsource/josefin-sans/300.css"
import "@fontsource/josefin-sans/400.css"
import "@fontsource/lato"
import "@fontsource/space-mono"
import "@fontsource/inter"
import "@fontsource-variable/inter"

// Using this instead of directly injectGlobal because stylelint works in this one.
const globalCss = css`
  ${cssReset}

  html, body {
    font-family: ${primaryFont};
    font-weight: 400;
    font-size: ${defaultFontSizePx}px;
    overflow-x: hidden;
  }
  h1,
  h2,
  h3,
  h4,
  h5,
  h6 {
    font-family: ${headingFont};
    font-weight: 400;
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
    font-variant-ligatures: none;
    font-feature-settings: "liga" 0;
  }
  .screen-reader-only {
    position: absolute;
    width: 1px;
    clip: rect(0 0 0 0);
    overflow: hidden;
    white-space: nowrap;
  }
  .${linkWithExtraIconClass} {
    align-items: center;
    margin-right: 0.1rem;

    svg {
      margin-left: 0.1rem;
      position: relative;
      top: 1px;
    }
  }
`

// eslint-disable-next-line @typescript-eslint/no-unused-expressions
injectGlobal`
${globalCss}
`

const GlobalStyles: React.FC<React.PropsWithChildren<React.PropsWithChildren<unknown>>> = () => null

export default GlobalStyles

"use client"

import { css, injectGlobal } from "@emotion/css"

import { headingFont, monospaceFont, primaryFont, typography } from "../../styles"
import { defaultFontSizePx, linkWithExtraIconClass } from "../../styles/constants"
import cssReset from "../../styles/cssReset"

// Exercise services ship only the Inter (variable) and Space Mono fonts to keep the
// dependency footprint minimal.
import "@fontsource-variable/inter/wght.css"
import "@fontsource/space-mono/400.css"

// Using this instead of directly injectGlobal because stylelint works in this one.
const globalCss = css`
  ${cssReset}

  html,
  body {
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
    clip-path: rect(0 0 0 0);
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

// oxlint-disable-next-line typescript/no-unused-expressions
injectGlobal`
${globalCss}
`

const GlobalStyles: React.FC = () => null

export default GlobalStyles

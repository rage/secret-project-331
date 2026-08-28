"use client"

import { css, injectGlobal } from "@emotion/css"

import {
  BASE_BUTTON_STYLES,
  PrimaryButtonStyles,
  SecondaryButtonStyles,
  TertiaryButtonStyles,
} from "@/shared-module/common/components/Button"

// One above the editor chrome's highest layer, so chart tooltips are not buried under it.
const VEGA_TOOLTIP_Z_INDEX = 1000003

// Using this instead of directly injectGlobal because stylelint works in this one.
const localCss = css`
  /* Qualified with body to outrank vega-tooltip's own rule, which it injects after this one. */
  body #vg-tooltip-element {
    z-index: ${VEGA_TOOLTIP_Z_INDEX};
  }
  /* The editor makes block SVGs inert so they cannot intercept selecting and dragging a block, but
     a chart has to answer the pointer or its tooltips never show. */
  .wp-block[data-type="moocfi/chart"] svg.marks {
    pointer-events: auto;
  }
  .wp-block-button__link {
    border-radius: 0;
    ${BASE_BUTTON_STYLES({ variant: "primary", size: "large" })}
  }
  /* stylelint-disable-next-line block-no-empty */
  .is-style-material-primary-button .wp-block-button__link {
    ${PrimaryButtonStyles({ variant: "primary", size: "large" })}
  }
  /* stylelint-disable-next-line block-no-empty */
  .is-style-material-secondary-button .wp-block-button__link {
    ${SecondaryButtonStyles({ variant: "secondary", size: "large" })}
  }
  /* stylelint-disable-next-line block-no-empty */
  .is-style-material-tertiary-button .wp-block-button__link {
    ${TertiaryButtonStyles({ variant: "tertiary", size: "large" })}
  }
`

// oxlint-disable-next-line typescript/no-unused-expressions
injectGlobal`
${localCss}
`

const LocalStyles: React.FC = () => null

export default LocalStyles

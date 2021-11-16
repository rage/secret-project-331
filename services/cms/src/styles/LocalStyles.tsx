/* eslint-disable i18next/no-literal-string */
import { css, injectGlobal } from "@emotion/css"

import {
  BaseButtonStyles,
  PrimaryButtonStyles,
  SecondaryButtonStyles,
  TertiaryButtonStyles,
} from "../shared-module/components/Button"

// Using this instead of directly injectGlobal because stylelint works in this one.
const localCss = css`
  .wp-block-button__link {
    border-radius: 0;
    ${BaseButtonStyles}
  }
  .is-style-material-primary-button .wp-block-button__link {
    ${PrimaryButtonStyles({ variant: "primary", size: "large" })}
  }
  .is-style-material-secondary-button .wp-block-button__link {
    ${SecondaryButtonStyles({ variant: "secondary", size: "large" })}
  }
  .is-style-material-tertiary-button .wp-block-button__link {
    ${TertiaryButtonStyles({ variant: "tertiary", size: "large" })}
  }
`

injectGlobal`
${localCss}
`

const LocalStyles: React.FC = () => null

export default LocalStyles

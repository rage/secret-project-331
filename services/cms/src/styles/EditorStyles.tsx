import { css } from "@emotion/css"

import { defaultContainerWidth } from "../shared-module/styles/constants"
import { respondToOrLarger } from "../shared-module/styles/respond"

/**
 * Hides Gutenberg's add component button. This may be desired if a custom implementation is
 * preferred instead. */
export const gutenbergControlsHidden = css`
  .block-editor-button-block-appender {
    display: none;
  }
`

/** Shows Gutenberg's add component button again if it was hidden in a parent component. */
export const gutenbergControlsVisible = css`
  .block-editor-button-block-appender {
    display: block;
  }
`

// Use only in CMS
// Sidebar removed at 75rem, sidebar width 280px
// eslint-disable-next-line i18next/no-literal-string
export const cmsNormalWidthCenteredComponentStyles = css`
  max-width: ${defaultContainerWidth}rem;
  margin-left: auto;
  margin-right: auto;
  ${respondToOrLarger.xl} {
    margin-right: calc(50% - 280px);
  }
`

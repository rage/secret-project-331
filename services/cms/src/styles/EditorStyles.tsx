import { css } from "@emotion/css"

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

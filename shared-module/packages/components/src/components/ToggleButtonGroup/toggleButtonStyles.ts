import { css } from "@emotion/css"

export const toggleButtonBaseCss = css`
  border-color: rgba(10, 15, 23, 0.12) transparent rgba(10, 15, 23, 0.12) transparent;
  &:first-child {
    border-radius: var(--control-radius) 0 0 var(--control-radius);
    margin-inline-start: 0;

    border-color: rgba(10, 15, 23, 0.12) transparent rgba(10, 15, 23, 0.12) rgba(10, 15, 23, 0.12);
  }

  &:last-child {
    border-radius: 0 var(--control-radius) var(--control-radius) 0;
    border-color: rgba(10, 15, 23, 0.12) rgba(10, 15, 23, 0.12) rgba(10, 15, 23, 0.12) transparent;
  }
`

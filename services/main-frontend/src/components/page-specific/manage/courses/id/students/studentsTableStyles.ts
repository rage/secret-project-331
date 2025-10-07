// studentsTableStyles.ts
import { css } from "@emotion/react"

export const tableOuterWrap = css`
  width: 100%;
  overflow-x: auto;
  position: relative;
`
export const tableStyle = css`
  width: 100%;
  min-width: 900px;
  border-collapse: separate;
  border-spacing: 0;
`
export const headerRowStyle = css`
  background: #f7f8f9;
  height: 48px;
`
export const thStyle = css`
  color: #1a2333;
  font-weight: 500;
  font-size: 14px;
  line-height: 140%;
  padding-left: 24px;
  text-align: left;
  height: 48px;
  background: #f7f8f9;
  border-bottom: 1px solid #ced1d7;
  vertical-align: middle;
  border-right: 1px solid #ced1d7;
  &:first-of-type {
    border-radius: 7px 0 0 0;
  }
  &:last-of-type {
    border-radius: 0 7px 0 0;
  }
`
export const rowStyle = css`
  height: 50px;
`
export const tdStyle = css`
  color: #1a2333;
  opacity: 0.8;
  font-weight: 400;
  font-size: 14px;
  line-height: 140%;
  padding-left: 24px;
  height: 50px;
  vertical-align: middle;
  background: #fff;
  border-bottom: 1px solid #ced1d7;
  border-right: 1px solid #ced1d7;
`
export const lastRowTdStyle = css`
  border-bottom: none;
`

export const noRightBorder = css`
  border-right: none !important;
`

export const noLeftBorder = css`
  border-left: none !important;
`

export const tableOuterScroll = css`
  width: 100%;
  overflow-x: auto;
  /* no flex! */
  background: transparent;
  /* preserves scroll bar */
`

export const tableCenteredInner = css`
  display: block;
  margin-left: auto;
  margin-right: auto;
  min-width: 900px;
  max-width: 90vw; // Optional: sets table max width to 90% of viewport
`

export const tableRoundedWrap = css`
  position: relative;
  border-radius: 8px;
  border: 1px solid #ced1d7;
  background: #fff;
  overflow: hidden;
  box-sizing: border-box;
`

export const topScrollbarWrap = css`
  height: 7px;
  overflow-x: auto;
  overflow-y: hidden;
  pointer-events: auto;
  background: transparent;
  border: none;

  /* was -11px when under header; not needed for trailer */
  margin-top: 0;

  /* WebKit */
  &::-webkit-scrollbar {
    height: 20px;
  }
  &::-webkit-scrollbar-track {
    background: transparent;
  }
  &::-webkit-scrollbar-thumb {
    background: #000;
    border-radius: 8px;
    border-left: 2px solid transparent;
    border-right: 2px solid transparent;
    background-clip: padding-box;
  }

  /* Firefox */
  scrollbar-width: thin;
  scrollbar-color: #000 transparent;
`

export const topScrollbarInner = css`
  /* Keep height equal to scrollbar so it doesn’t add extra spacing */
  height: 0px; /* no need for vertical size here */
  width: 100%;
`

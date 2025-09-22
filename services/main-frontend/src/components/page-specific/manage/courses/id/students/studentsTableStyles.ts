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
`
export const lastRowTdStyle = css`
  border-bottom: none;
`

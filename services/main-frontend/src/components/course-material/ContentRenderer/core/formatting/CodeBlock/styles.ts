import { css } from "@emotion/css"

import { monospaceFont } from "@/shared-module/common/styles"

export const containerStyles = css`
  position: relative;
  max-width: 1000px;
  margin: 0 auto;
`

export const preStyles = (fontSizePx: number, allowFullWidth: boolean) => css`
  margin-top: 0;
  font-size: ${fontSizePx}px;
  font-family: ${monospaceFont} !important;
  line-height: 1.75rem;
  white-space: pre-wrap;
  overflow-wrap: break-word;
  padding: 16px;
  ${allowFullWidth &&
  `
    margin-top: -1.5rem;
    margin-bottom: -1.5rem;
  `}
`

export const buttonStyles = css`
  position: absolute;
  top: 8px;
  right: 8px;
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  transition:
    transform 0.2s,
    background-color 0.2s;
  &:hover {
    transform: scale(1.1);
    background-color: rgba(0, 0, 0, 0.1);
  }
`

export const tooltipStyles = css`
  visibility: hidden;
  opacity: 0;
  background-color: #333;
  color: #fff;
  text-align: center;
  border-radius: 4px;
  padding: 4px 8px;
  position: absolute;
  z-index: 1;
  top: -30px;
  right: 0;
  transition: opacity 0.3s;
  white-space: nowrap;
  font-size: 12px;
  &::after {
    content: "";
    position: absolute;
    bottom: -5px;
    right: 10px;
    border-width: 5px;
    border-style: solid;
    border-color: #333 transparent transparent transparent;
  }
  button:hover & {
    visibility: visible;
    opacity: 1;
  }
`

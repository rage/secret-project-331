import { css } from "@emotion/css"

import { monospaceFont } from "@/shared-module/common/styles"

/** Long lines scroll sideways instead of wrapping, so a wrapped line can't read as a new statement. */
export const scrollerStyles = css`
  overflow-x: auto;
  border-radius: 4px;
  background-color: #282c34;
`

export const getPreStyles = (fontSizePx: number) => css`
  margin: 0;
  min-width: 100%;
  width: max-content;
  font-size: ${fontSizePx}px;
  font-family: ${monospaceFont} !important;
  line-height: 1.75rem;
  white-space: pre;
`

export const codeBlockStyles = css`
  /* Must track the .hljs background in highlight.js/styles/atom-one-dark.css. Set here too so the
     colour does not depend on whether emotion or the theme sheet is injected last. */
  background-color: #282c34;
  border-radius: 4px;
  font-variant-ligatures: none;
  font-feature-settings: "liga" 0;
  /* atom-one-dark comment (2.3:1) and subst (4.4:1) fall short of 4.5:1 on #282c34. */
  .hljs-comment,
  .hljs-quote {
    color: #9ca3af;
  }
  .hljs-subst {
    color: #ef8890;
  }
  .code-line {
    display: block;
  }
  /* Spans the code's padding on both sides, so the highlight reaches the block's edges. */
  .highlighted-line {
    background-color: rgba(255, 255, 100, 0.1);
    margin: 0 -3rem 0 -1em;
    padding: 0 3rem 0 calc(1em - 3px);
    border-left: 3px solid #ffd700;
  }
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

/** Fades the right edge while more of the lines is hidden there, so cut-off code reads as scrollable. */
export const scrollHintStyles = css`
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: 3rem;
  border-radius: 0 4px 4px 0;
  background: linear-gradient(to right, rgba(40, 44, 52, 0), #282c34);
  pointer-events: none;
`

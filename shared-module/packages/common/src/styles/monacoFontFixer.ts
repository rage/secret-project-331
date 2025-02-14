import { css } from "@emotion/css"

import { monospaceFont } from "."

const monacoFontFixer = css`
  .monaco-editor {
    font-family: ${monospaceFont} !important;
    --monaco-monospace-font: ${monospaceFont} !important;
  }
`

export default monacoFontFixer

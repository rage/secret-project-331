import { css } from "@emotion/css"

import { monospaceFont } from "."

const monacoStylesFixer = css`
  .monaco-editor {
    font-family: ${monospaceFont} !important;
    --monaco-monospace-font: ${monospaceFont} !important;
  }
  .monaco-editor.rename-box,
  .monaco-hover {
    top: 0;
  }
`

export default monacoStylesFixer

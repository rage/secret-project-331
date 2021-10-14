import { css } from "@emotion/css"

import { BlockRendererProps } from "../../.."
import { courseMaterialCenteredComponentStyles } from "../../../../../shared-module/styles/componentStyles"
import { FileAttributes } from "../../../../../types/GutenbergBlockAttributes"

const FileBlock: React.FC<BlockRendererProps<FileAttributes>> = ({ data }) => {
  return (
    <pre
      className={css`
        ${courseMaterialCenteredComponentStyles}
      `}
    >
      {JSON.stringify(data, undefined, 2)}
    </pre>
  )
}

export default FileBlock

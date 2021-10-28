import { css } from "@emotion/css"

import { BlockRendererProps } from "../.."
import { RssAttributes } from "../../../../../types/GutenbergBlockAttributes"
import { courseMaterialCenteredComponentStyles } from "../../../../shared-module/styles/componentStyles"

const RssBlock: React.FC<BlockRendererProps<RssAttributes>> = ({ data }) => {
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

export default RssBlock

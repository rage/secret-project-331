import { css } from "@emotion/css"

import { BlockAttributes } from "../../../types/GutenbergBlockAttributes"
import { baseTheme } from "../../shared-module/common/styles"
import withErrorBoundary from "../../shared-module/common/utils/withErrorBoundary"

import { BlockRendererProps } from "."

const DefaultBlock: React.FC<React.PropsWithChildren<BlockRendererProps<BlockAttributes>>> = ({
  data,
}) => {
  return (
    <div
      className={css`
        padding: 1rem;
        border: 1px solid ${baseTheme.colors.gray[400]};
      `}
    >
      <b>{data.name}</b>
      <pre>{JSON.stringify(data, undefined, 2)}</pre>
    </div>
  )
}

export default withErrorBoundary(DefaultBlock)

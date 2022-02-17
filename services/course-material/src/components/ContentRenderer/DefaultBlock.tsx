import { BlockAttributes } from "../../../types/GutenbergBlockAttributes"
import withErrorBoundary from "../../shared-module/utils/withErrorBoundary"

import { BlockRendererProps } from "."

const DefaultBlock: React.FC<BlockRendererProps<BlockAttributes>> = ({ data }) => {
  return <pre>{JSON.stringify(data, undefined, 2)}</pre>
}

export default withErrorBoundary(DefaultBlock)

import React from "react"

import { BlockRendererProps } from ".."
import BreakFromCentered from "../../../shared-module/components/Centering/BreakFromCentered"
import TopLevelPage, {
  TopLevelPageExtraProps,
} from "../../../shared-module/components/TopLevelPage"
import withErrorBoundary from "../../../shared-module/utils/withErrorBoundary"

const TopLevelPageBlock: React.FC<BlockRendererProps<TopLevelPageExtraProps>> = (props) => {
  return (
    <BreakFromCentered sidebar={false}>
      <TopLevelPage attributes={props.data.innerBlocks} />
    </BreakFromCentered>
  )
}
export default withErrorBoundary(TopLevelPageBlock)

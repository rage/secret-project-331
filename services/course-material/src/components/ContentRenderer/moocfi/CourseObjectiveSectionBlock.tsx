import React from "react"

import { BlockRendererProps, blockToRendererMap } from ".."
import BreakFromCentered from "../../../shared-module/components/Centering/BreakFromCentered"
import withErrorBoundary from "../../../shared-module/utils/withErrorBoundary"
import DefaultBlock from "../DefaultBlock"

import CourseObjectiveSection, { CourseObjectiveSectionProps } from "./CourseObjective/index"

const CourseObjectiveSectionBlock: React.FC<
  React.PropsWithChildren<BlockRendererProps<CourseObjectiveSectionProps>>
> = (props) => {
  return (
    <BreakFromCentered sidebar={false}>
      <CourseObjectiveSection title={props.data.attributes.title}>
        {props.data.innerBlocks.map((block) => {
          const Component = blockToRendererMap[block.name] ?? DefaultBlock
          return <Component key={block.clientId} data={block} />
        })}
      </CourseObjectiveSection>
    </BreakFromCentered>
  )
}

export default withErrorBoundary(CourseObjectiveSectionBlock)

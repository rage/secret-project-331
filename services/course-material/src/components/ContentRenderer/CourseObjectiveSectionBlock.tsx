import React from "react"

import CourseObjectiveSection, {
  CourseObjectiveSectionProps,
} from "../../shared-module/components/CourseObjectiveSection"
import withErrorBoundary from "../../shared-module/utils/withErrorBoundary"

import DefaultBlock from "./DefaultBlock"

import { BlockRendererProps, blockToRendererMap } from "."

const CourseObjectiveSectionBlock: React.FC<BlockRendererProps<CourseObjectiveSectionProps>> = (
  props,
) => {
  return (
    <CourseObjectiveSection title={props.data.attributes.title}>
      {props.data.innerBlocks.map((block) => {
        const Component = blockToRendererMap[block.name] ?? DefaultBlock
        return <Component key={block.clientId} data={block} />
      })}
    </CourseObjectiveSection>
  )
}

export default withErrorBoundary(CourseObjectiveSectionBlock)

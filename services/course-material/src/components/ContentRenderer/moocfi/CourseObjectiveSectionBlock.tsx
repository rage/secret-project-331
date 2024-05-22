import React from "react"

import { BlockRendererProps, blockToRendererMap } from ".."
import DefaultBlock from "../DefaultBlock"

import CourseObjectiveSection, { CourseObjectiveSectionProps } from "./CourseObjective/index"

import BreakFromCentered from "@/shared-module/common/components/Centering/BreakFromCentered"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

const CourseObjectiveSectionBlock: React.FC<
  React.PropsWithChildren<BlockRendererProps<CourseObjectiveSectionProps>>
> = (props) => {
  return (
    <>
      <BreakFromCentered sidebar={false}>
        <CourseObjectiveSection title={props.data.attributes.title}>
          {props.data.innerBlocks.map((block) => {
            const Component = blockToRendererMap[block.name] ?? DefaultBlock
            return <Component key={block.clientId} data={block} />
          })}
        </CourseObjectiveSection>
      </BreakFromCentered>
    </>
  )
}

export default withErrorBoundary(CourseObjectiveSectionBlock)

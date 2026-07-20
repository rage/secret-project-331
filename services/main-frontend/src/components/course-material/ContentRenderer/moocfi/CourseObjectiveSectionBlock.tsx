"use client"

import React from "react"

import BreakFromCentered from "@/shared-module/common/components/Centering/BreakFromCentered"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

import type { BlockRendererProps } from ".."
import { blockToRendererMap } from ".."
import DefaultBlock from "../DefaultBlock"
import type { CourseObjectiveSectionProps } from "./CourseObjective/index"
import CourseObjectiveSection from "./CourseObjective/index"

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

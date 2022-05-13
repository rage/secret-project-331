import React, { useContext, useEffect, useState } from "react"
import { useQuery } from "react-query"

import { BlockRendererProps } from ".."
import PageContext from "../../../contexts/PageContext"
import { isPageFrontPage } from "../../../services/backend"
import BreakFromCentered from "../../../shared-module/components/Centering/BreakFromCentered"
import LearningObjective, {
  LearningObjectiveProps,
} from "../../../shared-module/components/LearningObjectiveSection"
import withErrorBoundary from "../../../shared-module/utils/withErrorBoundary"

const PAGE = "PAGE"
const CHAPTER = "CHAPTER"

const LearningObjectiveSectionBlock: React.FC<BlockRendererProps<LearningObjectiveProps>> = (
  props,
) => {
  const pageContext = useContext(PageContext)
  const pageId = pageContext.pageData?.id

  const isChapterFrontPage = useQuery(`chapter-front-page-${pageId}`, () => {
    if (!pageId) {
      return false
    }
    return isPageFrontPage(pageId)
  })

  const heading = isChapterFrontPage
    ? props.data.attributes.title + " " + CHAPTER
    : props.data.attributes.title + " " + PAGE
  return (
    <BreakFromCentered sidebar={false}>
      {props.data.innerBlocks.map((block) => {
        return <LearningObjective title={heading} objectives={block} key={block.clientId} />
      })}
    </BreakFromCentered>
  )
}

export default withErrorBoundary(LearningObjectiveSectionBlock)

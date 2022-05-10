import React, { useContext } from "react"

import { BlockRendererProps } from ".."
import PageContext from "../../../contexts/PageContext"
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
  const url = pageContext.pageData?.url_path
  const lastSegment = url?.split("/").pop()?.includes("chapter")
  const heading = lastSegment
    ? props.data.attributes.title + " " + CHAPTER
    : props.data.attributes.title + " " + PAGE
  return (
    <BreakFromCentered sidebar={false}>
      {props.data.innerBlocks.map((block: any) => {
        const values = block?.attributes?.values
        const arr = values.match(/(<li>(.*?)<\/li>)/g).map((c: string) => c.replace(/<\/?li>/g, ""))
        return <LearningObjective title={heading} objectives={arr} key={block.clientId} />
      })}
    </BreakFromCentered>
  )
}

export default withErrorBoundary(LearningObjectiveSectionBlock)

import React, { useContext } from "react"
import { useTranslation } from "react-i18next"

import { BlockRendererProps } from ".."
import PageContext from "../../../contexts/PageContext"
import { isPageFrontPage } from "../../../services/backend"
import BreakFromCentered from "../../../shared-module/components/Centering/BreakFromCentered"
import LearningObjective, {
  LearningObjectiveProps,
} from "../../../shared-module/components/LearningObjectiveSection"
import withErrorBoundary from "../../../shared-module/utils/withErrorBoundary"

const LearningObjectiveSectionBlock: React.FC<BlockRendererProps<LearningObjectiveProps>> = (
  props,
) => {
  const { t } = useTranslation()
  const pageContext = useContext(PageContext)
  const pageId = pageContext.pageData?.id

  const isChapterFrontPage = () => {
    if (!pageId) {
      return false
    }
    return isPageFrontPage(pageId)
  }

  const heading = isChapterFrontPage()
    ? props.data.attributes.title + " " + t("chapter")
    : props.data.attributes.title + " " + t("page")
  return (
    <BreakFromCentered sidebar={false}>
      <LearningObjective title={heading} objectives={props.data.innerBlocks} />
    </BreakFromCentered>
  )
}

export default withErrorBoundary(LearningObjectiveSectionBlock)

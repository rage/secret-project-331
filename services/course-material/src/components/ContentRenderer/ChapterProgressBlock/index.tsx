import { css } from "@emotion/css"
import { useContext } from "react"

import { BlockRendererProps } from ".."
import CoursePageContext from "../../../contexts/CoursePageContext"
import { courseMaterialCenteredComponentStyles } from "../../../shared-module/styles/componentStyles"
import withErrorBoundary from "../../../shared-module/utils/withErrorBoundary"
import GenericLoading from "../../GenericLoading"

import ChapterProgress from "./ChapterProgress"

const ChapterProgressBlock: React.FC<BlockRendererProps<unknown>> = () => {
  const pageContext = useContext(CoursePageContext)

  if (pageContext.state !== "ready") {
    return <GenericLoading />
  }

  if (!pageContext.instance) {
    return (
      <div
        className={css`
          ${courseMaterialCenteredComponentStyles}
        `}
      >
        Select course version to see your progress.
      </div>
    )
  }
  if (!pageContext.pageData.chapter_id) {
    return <div>Chapter ID undefined in Chapter Progress Block</div>
  }
  return <ChapterProgress chapterId={pageContext.pageData.chapter_id} />
}

export default withErrorBoundary(ChapterProgressBlock)

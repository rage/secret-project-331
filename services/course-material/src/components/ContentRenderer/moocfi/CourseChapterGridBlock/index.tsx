import { css } from "@emotion/css"
import React, { useContext } from "react"

import CoursePageContext from "../../../../contexts/CoursePageContext"
import withErrorBoundary from "../../../../shared-module/utils/withErrorBoundary"
import GenericLoading from "../../../GenericLoading"

import ChapterGrid from "./ChapterGrid"

const CourseChapterGridBlock: React.FC = () => {
  const pageContext = useContext(CoursePageContext)

  if (pageContext.state !== "ready") {
    return <GenericLoading />
  }

  if (pageContext.pageData.course_id === null) {
    return <div>Error: Page is not associated with any course</div>
  }

  return (
    <div
      className={css`
        padding: 4em 0;
      `}
    >
      <ChapterGrid courseId={pageContext.pageData.course_id} />
    </div>
  )
}

export default withErrorBoundary(CourseChapterGridBlock)

import React, { useContext } from "react"

import CoursePageContext from "../../../contexts/CoursePageContext"
import { wideWidthCenteredComponentStyles } from "../../../shared-module/styles/componentStyles"
import withErrorBoundary from "../../../shared-module/utils/withErrorBoundary"
import GenericLoading from "../../GenericLoading"

import ChapterGrid from "./ChapterGrid"

const CourseChapterGridBlock: React.FC = () => {
  const pageContext = useContext(CoursePageContext)

  if (pageContext.state !== "ready") {
    return <GenericLoading />
  }

  return (
    <div className={wideWidthCenteredComponentStyles}>
      <ChapterGrid courseId={pageContext.pageData.course_id} />
    </div>
  )
}

export default withErrorBoundary(CourseChapterGridBlock)

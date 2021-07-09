import React, { useContext } from "react"

import CoursePageContext from "../../../contexts/CoursePageContext"
import { normalWidthCenteredComponentStyles } from "../../../styles/componentStyles"
import GenericLoading from "../../GenericLoading"

import ChapterGrid from "./ChapterGrid"

const CourseChapterGrid: React.FC = () => {
  const pageContext = useContext(CoursePageContext)

  if (pageContext.state !== "ready") {
    return <GenericLoading />
  }

  return (
    <div className={normalWidthCenteredComponentStyles}>
      <ChapterGrid courseId={pageContext.pageData.course_id} />
    </div>
  )
}

export default CourseChapterGrid

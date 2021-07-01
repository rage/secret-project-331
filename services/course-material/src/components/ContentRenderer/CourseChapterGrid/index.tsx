import React from "react"
import { useContext } from "react"
import PageContext from "../../../contexts/PageContext"
import { normalWidthCenteredComponentStyles } from "../../../styles/componentStyles"
import GenericLoading from "../../GenericLoading"
import ChapterGrid from "./ChapterGrid"

const CourseChapterGrid: React.FC = () => {
  const courseId = useContext(PageContext)?.course_id

  if (!courseId) {
    return <GenericLoading />
  }

  return (
    <div className={normalWidthCenteredComponentStyles}>
      <ChapterGrid courseId={courseId} />
    </div>
  )
}

export default CourseChapterGrid

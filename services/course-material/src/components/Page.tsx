import { css } from "@emotion/css"
import ContentRenderer from "./ContentRenderer"
import { CoursePage } from "../services/backend"
import { normalWidthCenteredComponentStyles } from "../styles/componentStyles"
import DebugModal from "./DebugModal"
import React, { useState } from "react"
import NavigationContainer from "./NavigationContainer"
import { useContext } from "react"
import PageContext, { CoursePageWithInstance } from "../contexts/PageContext"
import GenericLoading from "./GenericLoading"
import ChapterGrid from "./ContentRenderer/CourseChapterGrid/ChapterGrid"

interface Props {
  data: CoursePage
}

const Page: React.FC<Props> = () => {
  const pageContext = useContext(PageContext)

  // Make data editable so that we can edit it in the debug view
  const [editedData, setEditedData] = useState<CoursePageWithInstance | null>(pageContext)

  if (!editedData) {
    return <GenericLoading />
  }

  return (
    <>
      <div
        className={css`
          position: absolute;
          top: 10px;
          right: 10px;
        `}
      >
        <DebugModal data={editedData} updateDataOnClose={setEditedData} readOnly={false} />
      </div>
      <h1
        className={css`
          ${normalWidthCenteredComponentStyles}
        `}
      >
        {editedData.title}
      </h1>
      <ChapterGrid courseId={data.course_id} />
      <ContentRenderer data={editedData.content} />
      {editedData.chapter_id && <NavigationContainer />}
    </>
  )
}

export default Page

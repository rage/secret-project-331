import React, { useContext } from "react"
import { BlockRendererProps } from ".."
import CoursePageContext from "../../../contexts/CoursePageContext"
import { normalWidthCenteredComponentStyles } from "../../../styles/componentStyles"
import GenericLoading from "../../GenericLoading"
import PagesInChapter from "./PagesInChapter"

const PagesListBlock: React.FC<BlockRendererProps<unknown>> = () => {
  const pageContext = useContext(CoursePageContext)

  if (pageContext.state !== "ready") {
    return <GenericLoading />
  }

  const chapterId = pageContext.pageData.chapter_id

  if (!chapterId) {
    return <pre>PageListBlock: Missing chapter id on this page.</pre>
  }

  return (
    <div className={normalWidthCenteredComponentStyles}>
      <PagesInChapter chapterId={chapterId} />
    </div>
  )
}

export default PagesListBlock

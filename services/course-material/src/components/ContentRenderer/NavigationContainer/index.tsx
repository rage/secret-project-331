import React, { useContext } from "react"

import CoursePageContext from "../../../contexts/CoursePageContext"
import { normalWidthCenteredComponentStyles } from "../../../shared-module/styles/componentStyles"
import GenericLoading from "../../GenericLoading"

import NextPage from "./NextPage"

const NavigationContainer: React.FC = () => {
  const pageContext = useContext(CoursePageContext)

  if (pageContext.state !== "ready") {
    return <GenericLoading />
  }

  return (
    <div className={normalWidthCenteredComponentStyles}>
      <NextPage
        chapterId={pageContext.pageData.chapter_id}
        currentPageId={pageContext.pageData.id}
      />
    </div>
  )
}

export default NavigationContainer

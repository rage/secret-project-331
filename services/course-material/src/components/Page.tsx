import { css } from "@emotion/css"
import React, { useContext } from "react"

import ContentRenderer from "./ContentRenderer"
import { normalWidthCenteredComponentStyles } from "../styles/componentStyles"
import DebugModal from "./DebugModal"
import NavigationContainer from "./NavigationContainer"
import CoursePageContext, { CoursePageDispatch } from "../contexts/CoursePageContext"
import SelectCourseInstanceModal from "./modals/SelectCourseInstanceModal"

interface Props {
  onRefresh: () => void
}

const Page: React.FC<Props> = ({ onRefresh }) => {
  const pageContext = useContext(CoursePageContext)
  const pageDispatch = useContext(CoursePageDispatch)

  return (
    <>
      <div
        className={css`
          position: absolute;
          top: 10px;
          right: 10px;
        `}
      >
        <DebugModal
          data={pageContext}
          updateDataOnClose={(payload) => {
            // NB! This is unsafe because payload has any type
            pageDispatch({ type: "rawSetState", payload })
          }}
          readOnly={false}
        />
      </div>
      <h1
        className={css`
          ${normalWidthCenteredComponentStyles}
        `}
      >
        {pageContext.pageData?.title}
      </h1>
      <SelectCourseInstanceModal onClose={onRefresh} />
      <ContentRenderer data={pageContext.pageData?.content ?? []} />
      {pageContext.pageData?.chapter_id && <NavigationContainer />}
    </>
  )
}

export default Page

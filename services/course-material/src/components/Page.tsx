import { css } from "@emotion/css"
import React, { useContext } from "react"

import CoursePageContext, { CoursePageDispatch } from "../contexts/CoursePageContext"
import { Block } from "../services/backend"
import DebugModal from "../shared-module/components/DebugModal"
import { normalWidthCenteredComponentStyles } from "../styles/componentStyles"

import ContentRenderer from "./ContentRenderer"
import NavigationContainer from "./NavigationContainer"
import SelectCourseInstanceModal from "./modals/SelectCourseInstanceModal"

interface Props {
  onRefresh: () => void
}
console.log("test")

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
      {/* TODO: Better type for Page.content in bindings. */}
      <ContentRenderer data={(pageContext.pageData?.content as Array<Block<unknown>>) ?? []} />
      {pageContext.pageData?.chapter_id && <NavigationContainer />}
    </>
  )
}

export default Page

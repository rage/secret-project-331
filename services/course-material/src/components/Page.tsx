import { css } from "@emotion/css"
import React, { useContext } from "react"

import CoursePageContext, { CoursePageDispatch } from "../contexts/CoursePageContext"
import { Block } from "../services/backend"
import DebugModal from "../shared-module/components/DebugModal"
import { normalWidthCenteredComponentStyles } from "../shared-module/styles/componentStyles"

import ContentRenderer from "./ContentRenderer"
import NavigationContainer from "./ContentRenderer/NavigationContainer"
import FeedbackHandler from "./FeedbackHandler"
import SearchDialog from "./SearchDialog"
import SelectCourseInstanceModal from "./modals/SelectCourseInstanceModal"

interface Props {
  courseSlug: string
  onRefresh: () => void
}

const Page: React.FC<Props> = ({ courseSlug, onRefresh }) => {
  const pageContext = useContext(CoursePageContext)
  const pageDispatch = useContext(CoursePageDispatch)

  const courseId = pageContext?.pageData?.course_id

  return (
    <>
      <div
        className={css`
          text-align: right;
        `}
      >
        {courseId && <SearchDialog courseId={courseId} />}
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
      <FeedbackHandler courseSlug={courseSlug} />
      {/* TODO: Better type for Page.content in bindings. */}
      <div id="content">
        <ContentRenderer data={(pageContext.pageData?.content as Array<Block<unknown>>) ?? []} />
      </div>
      {pageContext.pageData?.chapter_id && <NavigationContainer />}
    </>
  )
}

export default Page

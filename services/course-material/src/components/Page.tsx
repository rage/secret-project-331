import { css } from "@emotion/css"
import React, { useContext } from "react"

import CoursePageContext, { CoursePageDispatch } from "../contexts/CoursePageContext"
import { Block } from "../services/backend"
import DebugModal from "../shared-module/components/DebugModal"

import ContentRenderer from "./ContentRenderer"
import NavigationContainer from "./ContentRenderer/NavigationContainer"
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
          text-align: right;
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
      <SelectCourseInstanceModal onClose={onRefresh} />
      {/* TODO: Better type for Page.content in bindings. */}
      <ContentRenderer data={(pageContext.pageData?.content as Array<Block<unknown>>) ?? []} />
      {pageContext.pageData?.chapter_id && <NavigationContainer />}
    </>
  )
}

export default Page

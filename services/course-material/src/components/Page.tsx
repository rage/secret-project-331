import { css } from "@emotion/css"
import React, { useContext } from "react"

import ContentRenderer from "./ContentRenderer"
import { normalWidthCenteredComponentStyles } from "../styles/componentStyles"
import DebugModal from "./DebugModal"
import NavigationContainer from "./NavigationContainer"
import CoursePageContext, { CoursePageDispatch } from "../contexts/CoursePageContext"
import { CoursePageState } from "../reducers/coursePageStateReducer"
import SelectCourseInstanceModal from "./modals/SelectCourseInstanceModal"

interface Props {
  data: CoursePageState
  onRefresh: () => void
}

const Page: React.FC<Props> = ({ data, onRefresh }) => {
  const pageDataDispatch = useContext(CoursePageDispatch)

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
          data={data}
          updateDataOnClose={(payload) => {
            // NB! This is unsafe because payload has any type
            pageDataDispatch({ type: "rawSetState", payload })
          }}
          readOnly={false}
        />
      </div>
      <h1
        className={css`
          ${normalWidthCenteredComponentStyles}
        `}
      >
        {data.pageData?.title}
      </h1>
      <CoursePageContext.Provider value={data}>
        <SelectCourseInstanceModal onClose={onRefresh} />
        <ContentRenderer data={data.pageData?.content ?? []} />
      </CoursePageContext.Provider>
      {data.pageData?.chapter_id && <NavigationContainer />}
    </>
  )
}

export default Page

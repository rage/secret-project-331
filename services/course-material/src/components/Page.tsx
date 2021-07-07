import { css } from "@emotion/css"
import React, { useEffect, useReducer } from "react"

import ContentRenderer from "./ContentRenderer"
import { normalWidthCenteredComponentStyles } from "../styles/componentStyles"
import DebugModal from "./DebugModal"
import NavigationContainer from "./NavigationContainer"
import CoursePageContext, { CoursePageDispatch } from "../contexts/CoursePageContext"
import { CourseInstance, CoursePage } from "../services/backend"
import coursePageStateReducer from "../reducers/coursePageStateReducer"

interface Props {
  instanceData: CourseInstance | null
  pageData: CoursePage | null
}

const Page: React.FC<Props> = ({ instanceData, pageData }) => {
  // Make data editable so that we can edit it in the debug view
  const [editedData, editedDataDispatch] = useReducer(coursePageStateReducer, {
    state: "loading",
    error: null,
    instance: null,
    pageData: null,
  })

  useEffect(() => {
    // Keep edited data up to date if props change.
    if (pageData) {
      editedDataDispatch({ type: "setData", payload: { pageData, instance: instanceData } })
    } else {
      editedDataDispatch({ type: "setLoading" })
    }
  }, [instanceData, pageData])

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
          data={editedData}
          updateDataOnClose={(payload) => {
            // This is unsafe because payload has any type
            editedDataDispatch({ type: "rawSetState", payload })
          }}
          readOnly={false}
        />
      </div>
      <h1
        className={css`
          ${normalWidthCenteredComponentStyles}
        `}
      >
        {editedData.pageData?.title}
      </h1>
      <CoursePageDispatch.Provider value={editedDataDispatch}>
        <CoursePageContext.Provider value={editedData}>
          <ContentRenderer data={editedData.pageData?.content ?? []} />
        </CoursePageContext.Provider>
      </CoursePageDispatch.Provider>
      {editedData.pageData?.chapter_id && <NavigationContainer />}
    </>
  )
}

export default Page

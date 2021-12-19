import React, { Dispatch } from "react"

import { CoursePageState, CoursePageStateAction } from "../reducers/coursePageStateReducer"

export const defaultCoursePageState: CoursePageState = {
  // eslint-disable-next-line i18next/no-literal-string
  state: "loading",
  error: null,
  instance: null,
  pageData: null,
  settings: null,
  exam: null,
}

const CoursePageContext = React.createContext<CoursePageState>(defaultCoursePageState)

export default CoursePageContext

export const CoursePageDispatch = React.createContext<Dispatch<CoursePageStateAction>>(() => {
  // eslint-disable-next-line i18next/no-literal-string
  throw new Error("CoursePageDispatch called outside provider.")
})

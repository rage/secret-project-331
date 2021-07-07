import React, { Dispatch } from "react"
import { CoursePageState, CoursePageStateAction } from "../reducers/coursePageStateReducer"

const defaultCoursePageState: CoursePageState = {
  state: "loading",
  error: null,
  instance: null,
  pageData: null,
}

const CoursePageContext = React.createContext<CoursePageState>(defaultCoursePageState)

export default CoursePageContext

export const CoursePageDispatch = React.createContext<Dispatch<CoursePageStateAction>>(() => {
  throw new Error("CoursePageDispatch called outside provider.")
})

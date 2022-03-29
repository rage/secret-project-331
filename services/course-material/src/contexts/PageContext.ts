import React, { Dispatch } from "react"

import { PageState, PageStateAction } from "../reducers/pageStateReducer"

export const defaultPageState: PageState = {
  // eslint-disable-next-line i18next/no-literal-string
  state: "loading",
  error: null,
  instance: null,
  pageData: null,
  settings: null,
  exam: null,
  isTest: false,
}

const PageContext = React.createContext<PageState>(defaultPageState)

export default PageContext

export const CoursePageDispatch = React.createContext<Dispatch<PageStateAction>>(() => {
  // eslint-disable-next-line i18next/no-literal-string
  throw new Error("CoursePageDispatch called outside provider.")
})

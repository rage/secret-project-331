import React, { Dispatch } from "react"

import { PageState, PageStateAction } from "../reducers/pageStateReducer"

export const getDefaultPageState = (refetchPage?: () => Promise<void>): PageState => ({
  state: "loading",
  error: null,
  instance: null,
  pageData: null,
  settings: null,
  exam: null,
  isTest: false,
  refetchPage,
})

const PageContext = React.createContext<PageState>(getDefaultPageState())

export default PageContext

export const CoursePageDispatch = React.createContext<Dispatch<PageStateAction> | null>(() => {
  throw new Error("CoursePageDispatch called outside provider.")
})

import React, { Dispatch } from "react"

import { PageState, PageStateAction } from "../reducers/pageStateReducer"

export const getDefaultPageState = (refetchPage?: () => Promise<void>): PageState => ({
  // eslint-disable-next-line i18next/no-literal-string
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
  // eslint-disable-next-line i18next/no-literal-string
  throw new Error("CoursePageDispatch called outside provider.")
})

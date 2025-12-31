"use client"

import React, { useCallback, useReducer, useState } from "react"

import LayoutContext from "@/contexts/course-material/LayoutContext"
import PageContext, {
  CoursePageDispatch,
  getDefaultPageState,
} from "@/contexts/course-material/PageContext"
import pageStateReducer from "@/reducers/course-material/pageStateReducer"
import type { PageState } from "@/reducers/course-material/pageStateReducer"

/**
 * Provides course material layout context to descendant components.
 */
function CourseMaterialProviders({ children }: { children: React.ReactNode }) {
  const [title, setTitle] = useState<string | null>(null)
  const [organizationSlug, setOrganizationSlug] = useState<string | null>(null)
  const [courseId, setCourseId] = useState<string | null>(null)
  const [hideFromSearchEngines, setHideFromSearchEngines] = useState<boolean>(false)
  const [pageState, pageStateDispatch] = useReducer(pageStateReducer, getDefaultPageState())

  const setPageState = useCallback(
    (state: PageState) => {
      pageStateDispatch({ type: "rawSetState", payload: state })
    },
    [pageStateDispatch],
  )

  return (
    <LayoutContext.Provider
      value={{
        title,
        setTitle,
        organizationSlug,
        setOrganizationSlug,
        courseId,
        setCourseId,
        hideFromSearchEngines,
        setHideFromSearchEngines,
        setPageState,
      }}
    >
      <CoursePageDispatch.Provider value={pageStateDispatch}>
        <PageContext.Provider value={pageState}>{children}</PageContext.Provider>
      </CoursePageDispatch.Provider>
    </LayoutContext.Provider>
  )
}

export default CourseMaterialProviders

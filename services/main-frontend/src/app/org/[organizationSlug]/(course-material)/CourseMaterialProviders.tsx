"use client"

import React, { useState } from "react"

import LayoutContext from "@/contexts/course-material/LayoutContext"
import { getDefaultPageState } from "@/contexts/course-material/PageContext"
import type { PageState } from "@/reducers/course-material/pageStateReducer"

/**
 * Provides course material layout context to descendant components.
 */
function CourseMaterialProviders({ children }: { children: React.ReactNode }) {
  const [title, setTitle] = useState<string | null>(null)
  const [organizationSlug, setOrganizationSlug] = useState<string | null>(null)
  const [courseId, setCourseId] = useState<string | null>(null)
  const [hideFromSearchEngines, setHideFromSearchEngines] = useState<boolean>(false)
  const [_pageState, setPageState] = useState<PageState>(getDefaultPageState())

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
      {children}
    </LayoutContext.Provider>
  )
}

export default CourseMaterialProviders

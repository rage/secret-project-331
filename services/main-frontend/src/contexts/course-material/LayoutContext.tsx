"use client"
import React from "react"

import type { PageState } from "./PageContext"

interface LayoutContextValue {
  title: string | null
  setTitle: (title: string | null) => void
  organizationSlug: string | null
  setOrganizationSlug: (slug: string | null) => void
  courseId: string | null
  setCourseId: (id: string | null) => void
  hideFromSearchEngines: boolean
  setHideFromSearchEngines: (hide: boolean) => void
  setPageState: (state: PageState) => void
}

const LayoutContext = React.createContext<LayoutContextValue | null>(null)

export default LayoutContext

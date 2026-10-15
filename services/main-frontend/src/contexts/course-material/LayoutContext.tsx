"use client"

import React from "react"

import type { PageState } from "./PageContext"

interface LayoutContextValue {
  organizationSlug: string | null
  setOrganizationSlug: (slug: string | null) => void
  courseId: string | null
  setCourseId: (id: string | null) => void
  setPageState: (state: PageState) => void
}

const LayoutContext = React.createContext<LayoutContextValue | null>(null)

export default LayoutContext

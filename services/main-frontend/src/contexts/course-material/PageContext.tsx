"use client"

import React from "react"

import type { CourseMaterialCourse, Page } from "@/generated/course-material-api/types.generated"

export interface PageState {
  course?: CourseMaterialCourse | null
  page?: Page | null
}

interface PageContextValue {
  course?: CourseMaterialCourse | null
  page?: Page | null
}

const PageContext = React.createContext<PageContextValue | null>(null)

export function getDefaultPageState(): PageState {
  return {
    course: null,
    page: null,
  }
}

export default PageContext

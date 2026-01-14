"use client"

import React from "react"

import type { Course, Page } from "@/shared-module/common/bindings"

export interface PageState {
  course?: Course | null
  page?: Page | null
}

interface PageContextValue {
  course?: Course | null
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

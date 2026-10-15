"use client"

import React from "react"

import type { Page } from "@/generated/api"

interface PageContextProps {
  page: Page
}

const PageContext = React.createContext<PageContextProps | null>(null)

export default PageContext

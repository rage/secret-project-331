"use client"

import React from "react"

import { Page } from "@/generated/api"

interface PageContextProps {
  page: Page
}

const PageContext = React.createContext<PageContextProps | null>(null)

export default PageContext

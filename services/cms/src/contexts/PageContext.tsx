import React from "react"

import { Page } from "../shared-module/bindings"

interface PageContextProps {
  page: Page
}

const PageContext = React.createContext<PageContextProps | null>(null)

export default PageContext

import React from "react"

import { Page } from "../shared-module/common/bindings"

interface PageContextProps {
  page: Page
}

const PageContext = React.createContext<PageContextProps | null>(null)

export default PageContext

import React from "react"

interface PageContextProps {
  organizationId: string
}

const PageContext = React.createContext<PageContextProps | null>(null)

export default PageContext

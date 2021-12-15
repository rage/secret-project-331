import React from "react"

import ComplexNav from "./ComplexNav"
import SimpleNav from "./SimpleNav"

export interface NavigationProps {
  variant: "simple" | "complex"
  frontPageUrl: string
  faqUrl?: string
  returnToPath?: string
}

const Navbar: React.FC<NavigationProps> = (props) => {
  if (props.variant === "simple") {
    return <SimpleNav {...props} />
  }
  return <ComplexNav {...props} />
}

export default Navbar

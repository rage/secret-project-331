import React from "react"

import BreadCrumbs from "./BreadCrumbs"
import ComplexNav from "./ComplexNav"
import SimpleNav from "./SimpleNav"

export interface NavigationProps {
  variant: "simple" | "complex" | "breadcrumbs"
  frontPageUrl: string
  faqUrl?: string
  returnToPath?: string
  text?: string
  url?: string
}

const Navbar: React.FC<NavigationProps> = (props) => {
  if (props.variant === "simple") {
    return <SimpleNav {...props} />
  } else if (props.variant === "breadcrumbs") {
    return <BreadCrumbs {...props} />
  }
  return <ComplexNav {...props} />
}

export default Navbar

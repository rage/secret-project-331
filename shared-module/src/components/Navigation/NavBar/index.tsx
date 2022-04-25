import React from "react"

import ComplexNav from "./ComplexNav"
import Menu from "./Menu/Menu"
import MenuItem from "./Menu/MenuItem"
import NavContainer from "./NavContainer"
import NavItem from "./NavItem"
import NavItems from "./NavItems"
import NavLink from "./NavLink"
import SimpleNav from "./SimpleNav"

export interface NavigationProps {
  variant: "simple" | "complex"
  frontPageUrl?: string
  faqUrl?: string
  SearchDialogComponent?: React.ReactNode
  returnToPath?: string
}

const NavBar: React.FC<NavigationProps> = (props) => {
  if (props.variant === "simple") {
    return <SimpleNav {...props} />
  }
  return <ComplexNav {...props} />
}

export { NavBar, Menu, MenuItem, NavItems, NavLink, NavContainer, NavItem }

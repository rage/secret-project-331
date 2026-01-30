"use client"

import { HamburgerSpring } from "./HamburgerSpring"

interface HamburgerProps {
  isActive: boolean
  barColor?: string
  buttonWidth?: number
}

const Hamburger: React.FC<HamburgerProps> = ({ isActive, barColor = "#333", buttonWidth = 30 }) => {
  return <HamburgerSpring barColor={barColor} buttonWidth={buttonWidth} isActive={isActive} />
}

export default Hamburger

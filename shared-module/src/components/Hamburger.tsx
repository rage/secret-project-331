import { useState, useCallback } from "react"
import { HamburgerSpring } from "react-animated-burgers"
import { cx, css } from "@emotion/css"

const Default = css`
  padding: 0;
`

const Hamburger = () => {
  const [isActive, setIsActive] = useState(false)

  const toggleButton = useCallback(() => setIsActive((prevState) => !prevState), [])

  return (
    <HamburgerSpring
      barColor="#333"
      buttonWidth={35}
      {...{ isActive, toggleButton }}
      className={cx(Default)}
    />
  )
}

export default Hamburger

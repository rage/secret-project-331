import { css, cx } from "@emotion/css"
import { useCallback, useState } from "react"

import { HamburgerSpring } from "./HamburgerSpring/HamburgerSpring"

const defaultPadding = css`
  padding: 0;
`

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
const Hamburger = () => {
  const [isActive, setIsActive] = useState(false)

  const toggleButton = useCallback(() => setIsActive((prevState) => !prevState), [])

  return (
    <HamburgerSpring
      barColor="#333"
      buttonWidth={30}
      {...{ isActive, toggleButton }}
      className={cx(defaultPadding)}
    />
  )
}

export default Hamburger

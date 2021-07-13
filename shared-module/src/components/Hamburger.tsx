import { css, cx } from "@emotion/css"
import { useCallback, useState } from "react"
import { HamburgerSpring } from "react-animated-burgers"

const Default = css`
  padding: 0;
`

const Hamburger = () => {
  const [isActive, setIsActive] = useState(false)

  const toggleButton = useCallback(() => setIsActive((prevState) => !prevState), [])

  return (
    <HamburgerSpring
      barColor="#333"
      buttonWidth={30}
      {...{ isActive, toggleButton }}
      className={cx(Default)}
    />
  )
}

export default Hamburger

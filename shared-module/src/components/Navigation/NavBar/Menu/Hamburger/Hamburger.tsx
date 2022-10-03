import { css, cx } from "@emotion/css"

import { HamburgerSpring } from "./HamburgerSpring"

const defaultPadding = css`
  padding: 0;
`

interface HamburgerProps {
  isActive: boolean
  toggleButton: () => void
  buttonId: string
}

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
const Hamburger: React.FC<React.PropsWithChildren<React.PropsWithChildren<HamburgerProps>>> = ({
  isActive,
  toggleButton,
  buttonId,
}) => {
  return (
    <HamburgerSpring
      barColor="#333"
      buttonWidth={30}
      {...{ isActive, toggleButton, buttonId }}
      className={buttonId === "main-navigation-menu" ? cx(defaultPadding) : undefined}
    />
  )
}

export default Hamburger

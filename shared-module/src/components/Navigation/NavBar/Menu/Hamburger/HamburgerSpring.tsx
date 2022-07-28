// From https://github.com/AuvikAlive/react-animated-burgers/tree/master/src/lib/components/HamburgerSpring

import styled from "@emotion/styled"

// eslint-disable-next-line i18next/no-literal-string
const getBarColor = ({ barColor }: { barColor: BarColor }) => `background-color: ${barColor};`
const getLayerHeight = (buttonWidth: ButtonWidth) => buttonWidth * 0.1
const getLayerSpacing = (buttonWidth: ButtonWidth) => buttonWidth * 0.15

const active = `
  transition-delay: 0.22s;
  background-color: transparent;
`

// eslint-disable-next-line i18next/no-literal-string
const getActiveBefore = (buttonWidth: ButtonWidth) => `
  top: 0;
  transition: top 0.1s 0.15s cubic-bezier(0.33333, 0, 0.66667, 0.33333), transform 0.13s 0.22s cubic-bezier(0.215, 0.61, 0.355, 1);
  transform: translate3d(0, ${
    getLayerHeight(buttonWidth) + getLayerSpacing(buttonWidth)
  }px, 0) rotate(45deg);
`

// eslint-disable-next-line i18next/no-literal-string
const getActiveAfter = (buttonWidth: ButtonWidth) => `
  top: 0;
  transition: top 0.2s cubic-bezier(0.33333, 0, 0.66667, 0.33333), transform 0.13s 0.22s cubic-bezier(0.215, 0.61, 0.355, 1);
  transform: translate3d(0, ${
    getLayerHeight(buttonWidth) + getLayerSpacing(buttonWidth)
  }px, 0) rotate(-45deg);
`

// eslint-disable-next-line i18next/no-literal-string
const getLinesCommon = ({ buttonWidth }: { buttonWidth: ButtonWidth }) => `
  width: ${buttonWidth}px;
  height: ${buttonWidth * 0.1}px;
  border-radius: ${buttonWidth * 0.1}px;
  position: absolute;
  transition-property: transform;
  transition-duration: 0.15s;
  transition-timing-function: ease;
`

// eslint-disable-next-line i18next/no-literal-string
const StyledLines = styled.span<LineProps>`
  display: block;
  top: 50%;
  margin-top: ${({ buttonWidth }) => -buttonWidth * 0.05}px;
  ${getBarColor}
  ${getLinesCommon}

  &::before,
  &::after {
    ${getBarColor}
    ${getLinesCommon}
    content: "";
    display: block;
  }

  &::before {
    top: ${({ buttonWidth }) => -buttonWidth * 0.25}px;
  }

  &::after {
    bottom: ${({ buttonWidth }) => -buttonWidth * 0.25}px;
  }
`

// eslint-disable-next-line i18next/no-literal-string
const StyledLinesSpring = styled(StyledLines)`
  &::before {
    top: ${({ buttonWidth }) => getLayerHeight(buttonWidth) + getLayerSpacing(buttonWidth)}px;
    transition: top 0.1s 0.2s cubic-bezier(0.33333, 0.66667, 0.66667, 1),
      transform 0.13s cubic-bezier(0.55, 0.055, 0.675, 0.19);
    ${({ isActive, buttonWidth }) => isActive && getActiveBefore(buttonWidth)}
    ${getBarColor}
  }

  &::after {
    top: ${({ buttonWidth }) =>
      2 * getLayerHeight(buttonWidth) + 2 * getLayerSpacing(buttonWidth)}px;
    transition: top 0.2s 0.2s cubic-bezier(0.33333, 0.66667, 0.66667, 1),
      transform 0.13s cubic-bezier(0.55, 0.055, 0.675, 0.19);
    ${({ isActive, buttonWidth }) => isActive && getActiveAfter(buttonWidth)}
    ${getBarColor}
  }

  top: ${({ buttonWidth }) => getLayerHeight(buttonWidth)}px;
  transition: background-color 0s 0.13s linear;
  ${getBarColor}
  ${({ isActive }) => isActive && active}
`

type BarColor = string
type ButtonColor = string
type ButtonWidth = number
type IsActive = boolean

type ButtonProps = {
  /**
   * Color of the bars, default 'black'
   */
  barColor?: BarColor
  /**
   * Component to use as the box
   */
  Box?: React.ElementType
  /**
   * Color of the button, default 'transparent'
   */
  buttonColor?: ButtonColor
  /**
   * Width of the button, default 40
   */
  buttonWidth?: ButtonWidth
  /**
   * ClassName for the button
   */
  className?: string
  /**
   * Specifies if the button is active or not, default false
   */
  isActive?: IsActive
  /**
   * Component to use as the bar lines
   */
  Lines?: React.ElementType
  /**
   * Callback to invoke on button click to toggle active state, default () => {}
   */
  toggleButton?: () => void
  /**
   * id to differirentiate Hamburger menus from each other, needed for accesibility
   */
  buttonId?: string
}

type StyledButtonProps = {
  buttonWidth: ButtonWidth
  buttonColor: ButtonColor
}

// eslint-disable-next-line i18next/no-literal-string
const StyledButton = styled.div<StyledButtonProps>`
  padding: ${({ buttonWidth }) => buttonWidth * 0.375}px;
  display: inline-block;
  cursor: pointer;
  transition-property: opacity, filter;
  transition-duration: 0.15s;
  transition-timing-function: linear;
  font: inherit;
  color: inherit;
  text-transform: none;
  background-color: ${({ buttonColor }) => buttonColor};
  margin: 0;
  border: none;
  overflow: visible;
`

const Button: React.FC<ButtonProps> = (props) => {
  const {
    barColor = "black",
    Box = StyledBox,
    buttonColor = "transparent",
    buttonWidth = 40,
    className,
    isActive = false,
    Lines = StyledLines,
    toggleButton,
    buttonId,
    ...rest
  } = props

  return (
    <StyledButton
      onClick={toggleButton}
      {...{ buttonWidth, buttonColor, className }}
      {...rest}
      id={buttonId}
    >
      <Box {...{ buttonWidth }}>
        <Lines {...{ buttonWidth, barColor, isActive }} />
      </Box>
    </StyledButton>
  )
}

export type LineProps = {
  barColor: BarColor
  buttonWidth: ButtonWidth
  isActive: IsActive
}

type StyledBoxProps = {
  buttonWidth: ButtonWidth
}

// eslint-disable-next-line i18next/no-literal-string
const StyledBox = styled.div<StyledBoxProps>`
  width: ${({ buttonWidth }) => buttonWidth}px;
  height: ${({ buttonWidth }) => buttonWidth * 0.6}px;
  display: inline-block;
  position: relative;
`

export const HamburgerSpring: React.FC<ButtonProps> = (props) => (
  <Button {...props} Lines={StyledLinesSpring} />
)

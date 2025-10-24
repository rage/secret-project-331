"use client"
// From https://github.com/AuvikAlive/react-animated-burgers/tree/master/src/lib/components/HamburgerSpring

import styled from "@emotion/styled"

// eslint-disable-next-line i18next/no-literal-string
const getBarColor = ({ barColor }: { barColor: BarColor }) => `background-color: ${barColor};`
const getLayerHeight = (buttonWidth: ButtonWidth) => buttonWidth * 0.1
const getLayerSpacing = (buttonWidth: ButtonWidth) => buttonWidth * 0.15

const active = `
  transition-delay: 0.15s;
  background-color: transparent;
`

const getActiveBefore = (buttonWidth: ButtonWidth) => `
  top: 0;
  transition: top 0.07s 0.1s cubic-bezier(0.33333, 0, 0.66667, 0.33333), transform 0.09s 0.15s cubic-bezier(0.215, 0.61, 0.355, 1);
  transform: translate3d(0, ${
    getLayerHeight(buttonWidth) + getLayerSpacing(buttonWidth)
  }px, 0) rotate(45deg);
`

const getActiveAfter = (buttonWidth: ButtonWidth) => `
  top: 0;
  transition: top 0.13s cubic-bezier(0.33333, 0, 0.66667, 0.33333), transform 0.09s 0.15s cubic-bezier(0.215, 0.61, 0.355, 1);
  transform: translate3d(0, ${
    getLayerHeight(buttonWidth) + getLayerSpacing(buttonWidth)
  }px, 0) rotate(-45deg);
`

const getLinesCommon = ({ buttonWidth }: { buttonWidth: ButtonWidth }) => `
  width: ${buttonWidth}px;
  height: ${buttonWidth * 0.1}px;
  border-radius: ${buttonWidth * 0.1}px;
  position: absolute;
  transition-property: transform;
  transition-duration: 0.1s;
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
    transition:
      top 0.07s 0.13s cubic-bezier(0.33333, 0.66667, 0.66667, 1),
      transform 0.09s cubic-bezier(0.55, 0.055, 0.675, 0.19);
    ${({ isActive, buttonWidth }) => isActive && getActiveBefore(buttonWidth)}
    ${getBarColor}
  }

  &::after {
    top: ${({ buttonWidth }) =>
      2 * getLayerHeight(buttonWidth) + 2 * getLayerSpacing(buttonWidth)}px;
    transition:
      top 0.13s 0.13s cubic-bezier(0.33333, 0.66667, 0.66667, 1),
      transform 0.09s cubic-bezier(0.55, 0.055, 0.675, 0.19);
    ${({ isActive, buttonWidth }) => isActive && getActiveAfter(buttonWidth)}
    ${getBarColor}
  }

  top: ${({ buttonWidth }) => getLayerHeight(buttonWidth)}px;
  transition: background-color 0s 0.09s linear;
  ${getBarColor}
  ${({ isActive }) => isActive && active}
`

type BarColor = string
type ButtonWidth = number
type IsActive = boolean

export type HamburgerIconProps = {
  barColor?: BarColor
  buttonWidth?: ButtonWidth
  isActive?: IsActive
  Box?: React.ElementType
  Lines?: React.ElementType
}

export type LineProps = {
  barColor: BarColor
  buttonWidth: ButtonWidth
  isActive: IsActive
}

type StyledBoxProps = {
  buttonWidth: ButtonWidth
}

const StyledBox = styled.div<StyledBoxProps>`
  width: ${({ buttonWidth }) => buttonWidth}px;
  height: ${({ buttonWidth }) => buttonWidth * 0.6}px;
  display: inline-block;
  position: relative;
`

export const HamburgerSpring: React.FC<HamburgerIconProps> = ({
  barColor = "black",
  buttonWidth = 40,
  isActive = false,
  Box = StyledBox,
}) => {
  return (
    <Box {...{ buttonWidth }}>
      <StyledLinesSpring {...{ buttonWidth, barColor, isActive }} />
    </Box>
  )
}

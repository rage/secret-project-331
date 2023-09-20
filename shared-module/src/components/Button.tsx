import styled from "@emotion/styled"
import React, { forwardRef, Ref } from "react"

import { baseTheme, fontWeights, headingFont, theme } from "../styles"
import { defaultFontSizePx } from "../styles/constants"
import { respondToOrLarger } from "../styles/respond"

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant: "primary" | "secondary" | "reject" | "tertiary" | "outlined" | "blue" | "white" | "icon"
  size: "small" | "medium" | "large"
  transform?: "capitalize" | "uppercase" | "none" | "lowercase"
  children?: React.ReactNode
}

// BaseButtonStyles is the primary button
export const BASE_BUTTON_STYLES = `
  position: relative;
  display: inline-block;
  padding: ${theme.buttonSizes["large"].padding};
  font-family: ${headingFont};
  font-weight: ${fontWeights.normal};
  font-size: ${defaultFontSizePx}px;
  line-height: normal;
  vertical-align: baseline;
  cursor: pointer;
  user-select: none;
  text-decoration: none;
  text-align: center;
  justify-content: center;
  text-transform: uppercase;
  letter-spacing: 0.02em;
  transition: all 150ms linear;
  border: 2.5px solid transparent;
  z-index: 1;
  white-space: nowrap;

  color: ${theme.primary.text};
  background-color: ${theme.primary.bg};
  border-color: ${theme.primary.border};

  &:hover {
    color: ${theme.primary.hoverBorder};
    background-color: ${theme.primary.hoverBg};
    border-color: ${theme.primary.hoverBorder};
    text-decoration: none;
  }

  &:active {
    color: ${theme.primary.hoverText};
    background-color: ${theme.primary.activeBg};
    border-color: ${theme.primary.hoverBorder};
  }

  &:disabled {
    color: ${theme.primary.disabledText};
    background-color: ${theme.primary.disabledBg};
    border-color: ${theme.primary.disabledBorder};
    cursor: not-allowed;
  }

  &:focus {
    text-decoration: none;
  }


  ${respondToOrLarger.sm} {
    white-space: nowrap;
  }
`

export const PrimaryButtonStyles = (props: ButtonProps) => {
  const PRIMARY_BUTTON_STYLES = `
    text-transform: ${props.transform};
    padding: ${theme.buttonSizes[props.size].padding};
  `
  return PRIMARY_BUTTON_STYLES
}

export const WhiteButtonStyles = (props: ButtonProps) => {
  const WHITE_BUTTON_STYLES = `
    text-transform: ${props.transform};
    padding: ${theme.buttonSizes[props.size].padding};

    color: ${theme.white.text};
    background: #FCFCFC;
    border: 1.5px solid #DEDEDE;

  `
  return WHITE_BUTTON_STYLES
}

export const IconButtonStyles = (props: ButtonProps) => {
  const ICON_BUTTON_STYLES = `
    text-transform: ${props.transform};
    padding: ${theme.buttonSizes[props.size].padding};
    color: black;
    background: none;
    border: 0px;

    &:hover, &:active, &:disabled {
      background: none;
    }

  `
  return ICON_BUTTON_STYLES
}

export const SecondaryButtonStyles = (props: ButtonProps) => {
  const SECONDARY_BUTTON_STYLES = `
    text-transform: ${props.transform};
    padding: ${theme.buttonSizes[props.size].padding};

    color: ${theme.secondary.text};
    background: ${theme.secondary.bg};
    border: 1.5px solid ${theme.secondary.border};

    &:hover,
    &:focus {
      color: ${theme.secondary.hoverText};
      box-shadow: 0 0 0 1px ${theme.secondary.text};
      border: 1.5px solid ${theme.secondary.text};
    }

    &:active {
      color: ${theme.secondary.hoverText};
      background-color: ${theme.secondary.activeBg};
    }

    &:disabled {
      color: ${theme.secondary.disabledText};
      background-color: ${theme.secondary.disabledBg};
      border-color: ${theme.secondary.disabledBorder};
    }
  `
  return SECONDARY_BUTTON_STYLES
}

export const RejectButtonStyles = (props: ButtonProps) => {
  const REJECT_BUTTON_STYLES = `
    text-transform: ${props.transform};
    padding: ${theme.buttonSizes[props.size].padding};

    color: ${theme.reject.text};
    background: ${theme.reject.bg};
    border: 1.5px solid ${theme.reject.border};

    &:hover,
    &:focus {
      color: ${theme.reject.hoverText};
      box-shadow: 0 0 0 1px ${theme.reject.text};
      border: 1.5px solid ${theme.reject.text};
    }

    &:active {
      color: ${theme.reject.hoverText};
      background-color: ${theme.reject.activeBg};
    }

    &:disabled {
      color: ${theme.reject.disabledText};
      background-color: ${theme.reject.disabledBg};
      border-color: ${theme.reject.disabledBorder};
    }
  `
  return REJECT_BUTTON_STYLES
}

export const TertiaryButtonStyles = (props: ButtonProps) => {
  const TERTIARY_BUTTON_STYLES = `
    text-transform: ${props.transform};
    padding: ${theme.buttonSizes[props.size].padding};

    color: ${theme.tertiary.text};
    background-color: ${theme.tertiary.bg};
    border: unset;

    &:hover {
      color: ${theme.tertiary.hoverText};
      background-color: ${theme.tertiary.hoverBg};
    }

    &:active {
      color: ${theme.tertiary.hoverText};
      background-color: ${theme.tertiary.activeBg};
    }

    &:disabled {
      color: ${theme.tertiary.disabledText};
      background-color: ${theme.tertiary.disabledBg};
      border-color: ${theme.tertiary.disabledBorder};
    }
  `
  return TERTIARY_BUTTON_STYLES
}

export const BlueButtonStyles = (props: ButtonProps) => {
  const BLUE_BUTTON_STYLES = `
    text-transform: ${props.transform};
    padding: ${theme.buttonSizes[props.size].padding};

    color: ${theme.tertiary.text};
    background-color: ${baseTheme.colors.blue[500]};
    border: unset;
    border: 2px solid ${theme.secondary.border};

    &:hover {
      border: 2px solid ${baseTheme.colors.blue[600]};
      color: ${baseTheme.colors.blue[700]};
    }

    &:active {
      border: 2px solid ${baseTheme.colors.blue[400]};
    }

    &:disabled {
      color: ${theme.secondary.disabledText};
      background-color: ${theme.secondary.disabledBg};
      border-color: ${theme.secondary.disabledBorder};
    }
  `
  return BLUE_BUTTON_STYLES
}

const PrimaryButton = styled.button`
  ${BASE_BUTTON_STYLES}
  ${PrimaryButtonStyles}
`

const SecondaryButton = styled.button`
  ${BASE_BUTTON_STYLES}
  ${SecondaryButtonStyles}
`

const RejectButton = styled.button`
  ${BASE_BUTTON_STYLES}
  ${RejectButtonStyles}
`

const TertiaryButton = styled.button`
  ${BASE_BUTTON_STYLES}
  ${TertiaryButtonStyles}
`

const BlueButton = styled.button`
  ${BASE_BUTTON_STYLES}
  ${BlueButtonStyles}
`

const WhiteButton = styled.button`
  ${BASE_BUTTON_STYLES}
  ${WhiteButtonStyles}
`
const IconButton = styled.button`
  ${BASE_BUTTON_STYLES}
  ${IconButtonStyles}
`

export const LabelButton = styled.label`
  ${BASE_BUTTON_STYLES}
`

/* BUTTON VARIANT
PrimaryButton
SecondaryButton
GhostButton
TertiaryButton
IconButton
Link */

const Button = forwardRef((props: ButtonProps, ref?: Ref<HTMLButtonElement>) => {
  switch (props.variant) {
    case "primary":
      return <PrimaryButton ref={ref} {...props} />
    case "secondary":
      return <SecondaryButton ref={ref} {...props} />
    case "reject":
      return <RejectButton ref={ref} {...props} />
    case "tertiary":
      return <TertiaryButton ref={ref} {...props} />
    case "outlined":
      return <SecondaryButton ref={ref} {...props} />
    case "blue":
      return <BlueButton ref={ref} {...props} />
    case "white":
      return <WhiteButton ref={ref} {...props} />
    case "icon":
      return <IconButton ref={ref} {...props} />
    default:
      return <PrimaryButton ref={ref} {...props} />
  }
})

// eslint-disable-next-line i18next/no-literal-string
Button.displayName = "Button"

export default Button

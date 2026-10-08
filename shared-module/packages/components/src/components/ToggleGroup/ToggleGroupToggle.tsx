/// One toggle button in a toggle group

"use client"

import { css } from "@emotion/css"
import { useRef } from "react"
import { mergeProps, useFocusRing, useHover, useToggleButtonGroupItem } from "react-aria"
import type { ToggleGroupState } from "react-aria-components"

import { omitUndefined } from "../../lib/utils/nullability"
import { Button } from "./../Button"

const buttonCss = (selected: boolean) => css`
  border-radius: 8px;
  & > span > span::first-letter {
    text-transform: uppercase;
  }
  ${
    selected &&
    `
    color: white;
    background: black;
    border: white;
  `
  }
`

const ToggleGroupToggle: React.FC<{ id: string; label: string; state: ToggleGroupState }> = ({
  id,
  label,
  state,
}) => {
  let ref = useRef<HTMLButtonElement>(null)
  let { buttonProps, isSelected, isPressed, isDisabled } = useToggleButtonGroupItem(
    { id },
    state,
    ref,
  )
  const { formAction: _, "aria-pressed": ariaPressed, tabIndex, ...buttonProps2 } = buttonProps
  let { hoverProps, isHovered } = useHover({})
  let { focusProps, isFocusVisible } = useFocusRing()
  const theProps = omitUndefined(mergeProps(buttonProps2, hoverProps, focusProps))
  return (
    <Button
      {...theProps}
      domProps={omitUndefined({
        "aria-pressed": ariaPressed,
        tabIndex,
      })}
      ref={ref}
      variant="secondary"
      className={buttonCss(isSelected)}
      data-selected={isSelected}
      data-pressed={isPressed}
      data-hovered={isHovered}
      data-focus-visible={isFocusVisible}
      data-disabled={isDisabled}
    >
      {label}
    </Button>
  )
}

export default ToggleGroupToggle

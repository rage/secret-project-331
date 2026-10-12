/// One toggle button in a toggle group. It looks more like a tag.

"use client"

import { css } from "@emotion/css"
import { useRef } from "react"
import { mergeProps, useFocusRing, useHover, useToggleButtonGroupItem } from "react-aria"
import type { ToggleGroupState } from "react-aria-components"

import { omitUndefined } from "../../lib/utils/nullability"
import { resolveButtonRootCss } from "../primitives/buttonStyles"

const buttonCss = (selected: boolean) => css`
  ${resolveButtonRootCss({ size: "medium", variant: "secondary" })}
  border-radius: 30px;
  border: 2px solid #0a0f17;

  ${
    selected &&
    `
    color: white;
    background: #0A0F17;
    border: white;
  `
  }
`

// works? or styled.span
const CapitalizedFirstLetter = css`
  display: inline-block;
  &::first-letter {
    text-transform: uppercase;
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
  const { formAction: _, ...buttonProps2 } = buttonProps
  let { hoverProps, isHovered } = useHover({})
  let { focusProps, isFocusVisible } = useFocusRing()
  const theProps = omitUndefined(mergeProps(buttonProps2, hoverProps, focusProps))
  return (
    <button
      {...theProps}
      ref={ref}
      className={buttonCss(isSelected)}
      data-selected={isSelected}
      data-pressed={isPressed}
      data-hovered={isHovered}
      data-focus-visible={isFocusVisible}
      data-disabled={isDisabled}
    >
      <span className={CapitalizedFirstLetter}>{label}</span>
    </button>
  )
}

export default ToggleGroupToggle

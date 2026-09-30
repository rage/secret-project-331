/// A group of buttons that function like a radio group

"use client"

import { css } from "@emotion/css"
import { useRef } from "react"
import {
  mergeProps,
  useFocusRing,
  useHover,
  useId,
  useToggleButtonGroup,
  useToggleButtonGroupItem,
} from "react-aria"
import type { ToggleButtonGroupProps, ToggleGroupState } from "react-aria-components"

import { omitUndefined } from "../lib/utils/nullability"
import { Button } from "./Button"

const buttonCss = (selected: boolean) => css`
  border-radius: 0;
  &:first-child {
    border-top-left-radius: 8px;
    border-bottom-left-radius: 8px;
  }
  &:last-child {
    border-top-right-radius: 8px;
    border-bottom-right-radius: 8px;
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

const buttonGroupCss = css`
  display: flex;
  flex-flow: row nowrap;
  gap: 0.25rem;
`

/// The name and identifier for a single toggle in a toggle group. The id is used
/// in the state to identify which toggles are selected.
export interface ToggleInfo {
  id: string
  name: string
}

type Props = {
  toggles: ToggleInfo[]
  groupLabel: string
  state: ToggleGroupState
} & ToggleButtonGroupProps

export const ToggleGroup: React.FC<Props> = (props) => {
  let labelId = useId()
  let { orientation = "horizontal" } = props
  let state = props.state
  let ref = useRef<HTMLDivElement>(null)
  let { groupProps } = useToggleButtonGroup(props, state, ref)

  return (
    <>
      <span id={labelId}>{props.groupLabel}</span>
      <div
        {...groupProps}
        ref={ref}
        className={buttonGroupCss}
        data-orientation={orientation}
        aria-labelledby={labelId}
      >
        {props.toggles.map((x, idx) => (
          <Toggle key={idx} id={x.id} label={x.name} state={state} />
        ))}
      </div>
    </>
  )
}

const Toggle: React.FC<{ id: string; label: string; state: ToggleGroupState }> = ({
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

/// add a commemt

"use client"

import { css } from "@emotion/css"
import { useRef } from "react"
import {
  mergeProps,
  useFocusRing,
  useHover,
  useToggleButtonGroup,
  useToggleButtonGroupItem,
} from "react-aria"
import type { ToggleButtonGroupProps, ToggleGroupState } from "react-aria-components"

const buttonCss = css``

type Props = {
  labels: string[]
  state: ToggleGroupState
} & ToggleButtonGroupProps

export const ToggleGroup: React.FC<Props> = (props) => {
  let { orientation = "horizontal" } = props
  let state = props.state
  let ref = useRef<HTMLDivElement>(null)
  let { groupProps } = useToggleButtonGroup(props, state, ref)

  return (
    <div
      {...groupProps}
      ref={ref}
      className="react-aria-ToggleButtonGroup"
      data-orientation={orientation}
    >
      {props.labels.map((x, idx) => (
        <Toggle key={idx} label={x} state={state} />
      ))}
    </div>
  )
}

const Toggle: React.FC<{ label: string; state: ToggleGroupState }> = ({ label, state }) => {
  let ref = useRef<HTMLButtonElement>(null)
  let { buttonProps, isSelected, isPressed, isDisabled } = useToggleButtonGroupItem(
    { id: label },
    state,
    ref,
  )
  let { hoverProps, isHovered } = useHover({})
  let { focusProps, isFocusVisible } = useFocusRing()

  return (
    <button
      {...mergeProps(buttonProps, hoverProps, focusProps)}
      ref={ref}
      className="react-aria-ToggleButton button-base"
      data-variant="primary"
      data-selected={isSelected || undefined}
      data-pressed={isPressed || undefined}
      data-hovered={isHovered || undefined}
      data-focus-visible={isFocusVisible || undefined}
      data-disabled={isDisabled || undefined}
    >
      {label}
    </button>
  )
}

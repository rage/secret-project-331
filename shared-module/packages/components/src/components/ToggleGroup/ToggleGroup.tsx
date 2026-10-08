/// A group of buttons that function like a radio group

"use client"

import { css } from "@emotion/css"
import { useRef } from "react"
import { useId, useToggleButtonGroup } from "react-aria"
import type { ToggleButtonGroupProps, ToggleGroupState } from "react-aria-components"

import ToggleGroupToggle from "./ToggleGroupToggle"

const buttonGroupCss = css`
  display: flex;
  flex-flow: row wrap;
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
          <ToggleGroupToggle key={idx} id={x.id} label={x.name} state={state} />
        ))}
      </div>
    </>
  )
}

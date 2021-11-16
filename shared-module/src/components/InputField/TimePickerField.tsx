import styled from "@emotion/styled"
import React from "react"

interface TimePickerExtraProps {
  label: string
  placeholder?: string
  value?: string
  max?: string
  min?: string
  readonly: boolean
  /*   onBlur?: (name?:string) => void */
  onChange: (value: string, name?: string) => void
}

export type TimePickerProps = React.HTMLAttributes<HTMLInputElement> & TimePickerExtraProps

const TimePicker = ({ onChange, ...rest }: TimePickerExtraProps) => {
  return (
    <label>
      <span>{rest.label}</span>
      <input type="time" onChange={({ target: { value } }) => onChange(value)} {...rest} />
    </label>
  )
}

export default TimePicker

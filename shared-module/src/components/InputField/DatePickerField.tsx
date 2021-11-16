import styled from "@emotion/styled"
import React from "react"

interface DatePickerExtraProps {
  label: string
  hint?: string
  placeholder?: string
  value?: string
  max?: string
  min?: string
  /*   onBlur?: (name?:string) => void */
  onChange: (value: string, name?: string) => void
}

export type DatePickerProps = React.HTMLAttributes<HTMLInputElement> & DatePickerExtraProps

const DatePicker = ({ onChange, ...rest }: DatePickerExtraProps) => {
  return (
    <label>
      <span>{rest.label}</span>
      <input type="date" onChange={({ target: { value } }) => onChange(value)} {...rest} />
    </label>
  )
}

export default DatePicker

import styled from "@emotion/styled"
import React from "react"

interface TextAreaExtraProps {
  label: string
  name: string
  errorMessage?: string
  placeholder?: string
  required?: boolean
  value?: string
  disabled: boolean
  maxlength: string
  /*   onBlur?: (name?:string) => void */
  onChange: (value: string, name?: string) => void
}

export type TextFieldProps = React.HTMLAttributes<HTMLInputElement> & TextAreaExtraProps

const TextArea = ({ onChange, ...rest }: TextAreaExtraProps) => {
  return (
    <label>
      <span>{rest.label}</span>
      <textarea onChange={({ target: { value } }) => onChange(value)} {...rest} />
    </label>
  )
}

export default TextArea

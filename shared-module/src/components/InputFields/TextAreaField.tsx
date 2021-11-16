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

const Wrapper = styled.div`
  label {
    display: grid;

    span {
      color: #333;
      font-size: 14px;
      font-weight: 500;
      margin-bottom: 0.2rem;
    }
  }
`

export type TextFieldProps = React.HTMLAttributes<HTMLInputElement> & TextAreaExtraProps

const TextArea = ({ onChange, ...rest }: TextAreaExtraProps) => {
  return (
    <Wrapper>
      <label>
        <span>{rest.label}</span>
        <textarea onChange={({ target: { value } }) => onChange(value)} {...rest} />
      </label>
    </Wrapper>
  )
}

export default TextArea

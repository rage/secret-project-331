import styled from "@emotion/styled"
import React from "react"

interface TextAreaExtraProps {
  label?: string
  name?: string
  errorMessage?: string
  placeholder?: string
  required?: boolean
  value?: string
  disabled?: boolean
  maxlength?: string
  onChange: (value: string, name?: string) => void
  onKeyPress: (event: any) => void
}

const Wrapper = styled.div`
  label {
    display: grid;

    textarea {
      background: #fcfcfc;
      border: 1.6px solid #dedede;
      padding: 0.4rem 0.8rem;
    }

    span {
      color: #333;
      font-size: 14px;
      font-weight: 500;
      margin-bottom: 0.2rem;
    }
  }
`

export type TextFieldProps = React.HTMLAttributes<HTMLInputElement> & TextAreaExtraProps

const TextArea = ({ onChange, onKeyPress, ...rest }: TextAreaExtraProps) => {
  return (
    <Wrapper>
      <label>
        <span>{rest.label}</span>
        <textarea
          onChange={({ target: { value, name } }) => onChange(value, name)}
          onKeyPress={(event) => onKeyPress(event)}
          {...rest}
        />
      </label>
    </Wrapper>
  )
}

export default TextArea

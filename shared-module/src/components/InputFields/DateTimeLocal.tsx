import styled from "@emotion/styled"
import React from "react"

interface TimePickerExtraProps {
  label: string
  placeholder?: string
  value?: string
  max?: string
  min?: string
  readOnly?: boolean
  onChange: (value: string, name?: string) => void
}

const Wrapper = styled.div`
  label {
    display: grid;

    input {
      max-width: 26ch;
      padding: 4px 10px;
      border: 2px solid #dedede;
      border-radius: 3px;
      outline: none;

      &:focus,
      &:active {
        border-color: #55b3f5;
      }
    }

    span {
      color: #333;
      font-size: 14px;
      font-weight: 500;
      margin-bottom: 0.2rem;
    }
  }
`

export type TimePickerProps = React.HTMLAttributes<HTMLInputElement> & TimePickerExtraProps

const TimePicker = ({ onChange, ...rest }: TimePickerExtraProps) => {
  return (
    <Wrapper>
      <label>
        <span>{rest.label}</span>
        <input
          type="datetime-local"
          onChange={({ target: { value } }) => onChange(value)}
          {...rest}
        />
      </label>
    </Wrapper>
  )
}

export default TimePicker

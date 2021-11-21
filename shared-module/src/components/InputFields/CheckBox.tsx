import { css, cx } from "@emotion/css"
import styled from "@emotion/styled"
import React from "react"

import { headingFont, primaryFont } from "../../styles"
interface CheckboxFieldExtraProps {
  label: string
  error?: boolean
  checked: boolean
  name?: string
  onBlur?: (name?: string) => void
  onChange: (checked: boolean, name?: string) => void
}

const Label = styled.label`
  font-family: system-ui, sans-serif;
  font-size: 1.2rem;
  line-height: 1.1;
  display: grid;
  grid-template-columns: 1em auto;
  gap: 0.5em;

  input[type="checkbox"] {
    appearance: none;
    background-color: #fff;
    margin: 0;
    font: inherit;
    color: currentColor;
    width: 1.15em;
    height: 1.1em;
    border: 2px solid ${({ error }: any) => (error ? "#F76D82" : "#787878")};
    transform: translateY(-0.075em);
    display: grid;
    place-content: center;
  }

  input[type="checkbox"]:hover {
    background: #f9f9f9;
  }

  input[type="checkbox"]:before {
    content: "";
    width: 0.65em;
    height: 0.65em;
    transform: scale(0);
    transition: 120ms transform ease-in-out;
    box-shadow: inset 1em 1em #fff;
    clip-path: polygon(28% 38%, 41% 53%, 75% 24%, 86% 38%, 40% 78%, 15% 50%);
  }

  input[type="checkbox"]:checked {
    border-color: #37bc9b;
    background: #37bc9b;
  }
  input[type="checkbox"]:checked::before {
    transform: scale(1);
  }

  input[type="checkbox"]:disabled {
    color: #959495;
    cursor: not-allowed;
  }
`

const disabled = css`
  color: #959495;
  cursor: not-allowed;
`
const error = css`
  color: #f76d82;
  font-size: 14px;
  display: inline-block;
  margin-top: -15px;
`

// Error string might change in the future

const ERROR = "Please check the secret box"

export type CheckboxProps = React.HTMLAttributes<HTMLInputElement> & CheckboxFieldExtraProps

const CheckBox = ({ onChange, ...rest }: CheckboxFieldExtraProps) => {
  return (
    <>
      <Label {...rest}>
        <input
          type="checkbox"
          aria-describedby={`${rest.label}_error`}
          onChange={({ target: { checked } }) => onChange(checked)}
          {...rest}
        />
        <span>{rest.label}</span>
      </Label>
      {rest.error && (
        <span className={cx(error)} id={`${rest.label}_error`}>
          {ERROR}
        </span>
      )}
    </>
  )
}

export default CheckBox

import { css, cx } from "@emotion/css"
import React from "react"

interface RadioFieldExtraProps {
  label: string
  checked: true
  value?: string
  onBlur?: (name?: string) => void
  onChange: (value: string, name?: string) => void
}

const label = css`
  font-family: system-ui, sans-serif;
  font-size: 1.2rem;
  line-height: 1.1;
  display: grid;
  grid-template-columns: 1em auto;
  gap: 0.5em;

  input[type="radio"] {
    appearance: none;
    background-color: #fff;
    margin: 0;
    font: inherit;
    color: currentColor;
    width: 1.15em;
    height: 1.15em;
    border: 1.5px solid #787878;
    border-radius: 50%;
    transform: translateY(-0.075em);
    display: grid;
    place-content: center;
  }

  input[type="radio"]::before {
    content: "";
    width: 0.65em;
    height: 0.65em;
    border-radius: 50%;
    transform: scale(0);
    transition: 120ms transform ease-in-out;
    background-color: #37bc9b;
  }

  input[type="radio"]:checked::before {
    transform: scale(1);
    background: #37bc9b;
  }
`

export type RadioFieldProps = React.HTMLAttributes<HTMLInputElement> & RadioFieldExtraProps

const RadioField = ({ onChange, ...rest }: RadioFieldExtraProps) => {
  return (
    <label className={cx(label)}>
      <input type="radio" onChange={({ target: { value } }) => onChange(value)} {...rest} />
      <span>{rest.label}</span>
    </label>
  )
}

export default RadioField

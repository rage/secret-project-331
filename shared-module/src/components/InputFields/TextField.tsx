import { css, cx } from "@emotion/css"
import styled from "@emotion/styled"
import React from "react"

import { headingFont, primaryFont } from "../../styles"

interface TextFieldExtraProps {
  type?: "email" | "password" | "text"
  label: string
  hint?: string
  error?: boolean
  placeholder?: string
  required?: boolean
  value?: string
  /*   onBlur?: (name?:string) => void */
  onChange: (value: string, name?: string) => void
}

const Input = styled.input`
  background: #fcfcfc;
  border-width: 1.6px;
  border-style: solid;
  border-radius: 3px;
  border-color: ${({ error }) => (error ? "#F76D82" : "#dedede")};
  padding: 4px 12px;
  transition: ease-in-out, width 0.35s ease-in-out;
  outline: none;
  min-width: 280px;
  display: block;

  &:focus,
  &:active {
    border-color: #55b3f5;
  }
`
const label = css`
  color: #333;
  font-family: ${primaryFont};
  font-weight: 500;
  font-size: 14px;
  display: inline-block;
  margin-bottom: 2px;
`

const error = css`
  color: #f76d82;
  font-size: 14px;
  display: inline-block;
  margin-top: -15px;
`

const Wrapper = styled.div``

export type TextFieldProps = React.HTMLAttributes<HTMLInputElement> & TextFieldExtraProps

const TextField = ({ onChange, ...rest }: TextFieldExtraProps) => {
  return (
    <Wrapper>
      <label>
        <span className={cx(label)}>{rest.label}</span>
        <Input
          /* className={cx(input)} */
          onChange={({ target: { value } }) => onChange(value)}
          {...rest}
        />
      </label>
      {rest.error && <span className={cx(error)}>Please input a valid string</span>}
    </Wrapper>
  )
}

export default TextField

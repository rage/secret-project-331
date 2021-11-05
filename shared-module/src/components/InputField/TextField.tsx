import React from 'react'
import styled from '@emotion/styled'

interface TextFieldExtraProps {
  type?: "email" | "password" | "text"
  label: string
  hint?: string
  errorMessage?: string
  placeholder?: string
  required?: boolean
  value?: string
/*   onBlur?: (name?:string) => void */
  onChange: (value:string, name?:string) => void
}

export type TextFieldProps = React.HTMLAttributes<HTMLInputElement> & TextFieldExtraProps

const TextField = ({onChange, ...rest}: TextFieldExtraProps) => {

  return (
    <label><span>{rest.label}</span>
    <input onChange={({ target: { value }}) => onChange(value)} {...rest} />
    </label>
  )
}

export default TextField;

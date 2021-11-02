import React from 'react'
import styled from '@emotion/styled'

interface TextFieldPropsExtraProps {
  type?: "email" | "password" | "text"
  label?: string
  hint?: string
  errorMessage?: string
  placeholder?: string
  required?: boolean
  value?: string
/*   onBlur?: (name?:string) => void */
  onChange: (value:string, name?:string) => void
}

export type TextFieldProps = React.HTMLAttributes<HTMLInputElement> & TextFieldPropsExtraProps

const TextField = ({onChange, ...rest}: TextFieldPropsExtraProps) => {

  return (
    <input onChange={({ target: { value }}) => onChange(value)} {...rest} />
  )
}

export default TextField;

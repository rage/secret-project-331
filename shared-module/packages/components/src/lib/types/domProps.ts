import type React from "react"

type OwnedInputKeys =
  | "value"
  | "defaultValue"
  | "checked"
  | "defaultChecked"
  | "onChange"
  | "onBlur"
  | "onFocus"
  | "name"
  | "id"
  | "disabled"
  | "required"
  | "readOnly"
  | "ref"
  | "min"
  | "max"
  | "maxLength"
  | "minLength"
  | "pattern"
  | "type"
  | "inputMode"
  | "placeholder"
  | "autoComplete"
  | "className"
  | "aria-describedby"
  | "aria-label"
  | "aria-invalid"

type OwnedTextareaKeys =
  | "value"
  | "defaultValue"
  | "onChange"
  | "onBlur"
  | "onFocus"
  | "name"
  | "id"
  | "disabled"
  | "required"
  | "readOnly"
  | "ref"
  | "maxLength"
  | "minLength"
  | "placeholder"
  | "autoComplete"
  | "className"
  | "aria-describedby"
  | "aria-label"
  | "aria-invalid"

type OwnedButtonKeys =
  | "onClick"
  | "onMouseDown"
  | "onMouseUp"
  | "onKeyDown"
  | "onKeyUp"
  | "onFocus"
  | "onBlur"
  | "disabled"
  | "type"
  | "name"
  | "value"
  | "formAction"
  | "id"
  | "className"
  | "aria-describedby"
  | "aria-label"
  | "aria-invalid"

type OwnedSelectKeys =
  | "name"
  | "value"
  | "defaultValue"
  | "onChange"
  | "onBlur"
  | "onFocus"
  | "disabled"
  | "required"
  | "autoComplete"
  | "form"
  | "id"
  | "className"
  | "aria-describedby"
  | "aria-label"
  | "aria-invalid"

type OwnedFieldsetKeys =
  | "name"
  | "onChange"
  | "disabled"
  | "className"
  | "aria-describedby"
  | "aria-label"
  | "aria-invalid"

type OwnedDivKeys =
  | "onFocus"
  | "onBlur"
  | "className"
  | "aria-describedby"
  | "aria-label"
  | "aria-invalid"

export type InputDomProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, OwnedInputKeys>
export type TextareaDomProps = Omit<
  React.TextareaHTMLAttributes<HTMLTextAreaElement>,
  OwnedTextareaKeys
>
export type ButtonDomProps = Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, OwnedButtonKeys>
export type SelectDomProps = Omit<React.SelectHTMLAttributes<HTMLSelectElement>, OwnedSelectKeys>
export type FieldsetDomProps = Omit<
  React.FieldsetHTMLAttributes<HTMLFieldSetElement>,
  OwnedFieldsetKeys
>
export type DivDomProps = Omit<React.HTMLAttributes<HTMLDivElement>, OwnedDivKeys>

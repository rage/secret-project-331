"use client"

import React from "react"

import { TextArea, type TextAreaProps } from "../TextArea"

export type EditableComponentTextAreaProps = Omit<TextAreaProps, "appearance">

// eslint-disable-next-line i18next/no-literal-string
const plainAppearance: TextAreaProps["appearance"] = "plain"

export const EditableComponentTextArea = React.forwardRef<
  HTMLTextAreaElement,
  EditableComponentTextAreaProps
>(function EditableComponentTextArea(props, forwardedRef) {
  return <TextArea {...props} ref={forwardedRef} appearance={plainAppearance} />
})

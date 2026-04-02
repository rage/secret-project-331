"use client"

import React from "react"

import { TextAreaBase, type TextAreaProps } from "../TextArea"

export type EditableComponentTextAreaProps = TextAreaProps

export const EditableComponentTextArea = React.forwardRef<
  HTMLTextAreaElement,
  EditableComponentTextAreaProps
>(function EditableComponentTextArea(props, forwardedRef) {
  // eslint-disable-next-line i18next/no-literal-string -- internal appearance variant
  return <TextAreaBase {...props} ref={forwardedRef} appearance="plain" />
})

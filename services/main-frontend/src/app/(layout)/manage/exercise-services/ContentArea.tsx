"use client"

import { css } from "@emotion/css"
import React, { useEffect } from "react"
import { useForm } from "react-hook-form"

import { omitUndefined } from "@/shared-module/common/utils/nullability"
import { TextField } from "@/shared-module/components"

type inputType = "number" | "text"
interface ContentAreaProps {
  title: string
  text: string | number | null
  editing: boolean
  onChange: (value: string) => void
  type: inputType
  error?: string
}

interface ContentAreaFields {
  value: string | number | null
}

const ContentArea: React.FC<React.PropsWithChildren<ContentAreaProps>> = ({
  title,
  text,
  error,
  editing,
  onChange,
  type,
}) => {
  const { control, watch, setValue } = useForm<ContentAreaFields>({
    defaultValues: { value: text },
  })
  const fieldValue = watch("value")

  // `text` can change from outside (e.g. editing the name also derives the slug), so the field
  // has to resync instead of only ever pushing its own edits outward.
  useEffect(() => {
    if (text !== fieldValue) {
      setValue("value", text)
    }
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [text])

  useEffect(() => {
    if (fieldValue !== text) {
      onChange(String(fieldValue ?? ""))
    }
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [fieldValue])

  return (
    <div
      className={css`
        margin-bottom: 12px;
      `}
    >
      {editing ? (
        <TextField
          name="value"
          control={control}
          label={title}
          type={type}
          {...omitUndefined({ errorMessage: error })}
        />
      ) : (
        <>
          <strong>{title}:</strong>
          <br />
          <span> {text} </span>
        </>
      )}
    </div>
  )
}

export default ContentArea

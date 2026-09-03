"use client"

import { css } from "@emotion/css"
import styled from "@emotion/styled"
import type { UseMutationResult } from "@tanstack/react-query"
import React, { useEffect, useRef, useState } from "react"
import { useForm, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { FileField, useDialog } from "@/shared-module/components"

const FieldContainer = styled.div`
  margin-bottom: 1rem;
`

export interface UploadImageFormProps {
  mutation: UseMutationResult<unknown, unknown, File, unknown>
  hasExistingImage?: boolean
}

interface UploadImageFields {
  image: File[]
}

const IMAGE_FIELD_NAME = "image"

const UploadImageForm: React.FC<React.PropsWithChildren<UploadImageFormProps>> = ({
  mutation,
  hasExistingImage,
}) => {
  const { t } = useTranslation()
  const { confirm } = useDialog()
  const { control, setValue } = useForm<UploadImageFields>({ defaultValues: { image: [] } })
  const selectedFile = useWatch({ control, name: IMAGE_FIELD_NAME })?.[0]
  const processedFileRef = useRef<File | null>(null)
  // Remounting FileField clears its native <input>, so the browser fires a change event
  // if the user declines the confirm dialog and then reselects the very same file.
  const [resetKey, setResetKey] = useState(0)

  useEffect(() => {
    if (!selectedFile || selectedFile === processedFileRef.current) {
      return
    }
    processedFileRef.current = selectedFile

    const handleSelectedFile = async () => {
      if (hasExistingImage) {
        const confirmed = await confirm({
          message: t("confirm-replace-existing-image"),
          title: t("confirm-replace-existing-image-title"),
          isDestructive: true,
        })
        if (!confirmed) {
          processedFileRef.current = null
          setValue(IMAGE_FIELD_NAME, [])
          setResetKey((key) => key + 1)
          return
        }
      }
      try {
        await mutation.mutateAsync(selectedFile)
      } catch {
        // Surfaced through mutation.isError by the caller; nothing to do here.
      }
    }
    handleSelectedFile()
  }, [selectedFile, hasExistingImage, confirm, mutation, setValue, t])

  return (
    <div
      className={css`
        margin: 2rem 0rem;
      `}
    >
      <FieldContainer>
        <FileField
          key={resetKey}
          control={control}
          name={IMAGE_FIELD_NAME}
          label={t("button-text-select-image")}
          isDisabled={mutation.isPending}
          // oxlint-disable-next-line i18next/no-literal-string
          accept="image/*"
        />
      </FieldContainer>
    </div>
  )
}

export default UploadImageForm

import { css } from "@emotion/css"
import styled from "@emotion/styled"
import { UseMutationResult } from "@tanstack/react-query"
import React, { createRef } from "react"
import { useTranslation } from "react-i18next"

import { LabelButton } from "@/shared-module/common/components/Button"
import { useDialog } from "@/shared-module/common/components/dialogs/DialogProvider"

const FieldContainer = styled.div`
  margin-bottom: 1rem;
`

export interface UploadImageFormProps {
  mutation: UseMutationResult<unknown, unknown, File, unknown>
  hasExistingImage?: boolean
}

const UploadImageForm: React.FC<React.PropsWithChildren<UploadImageFormProps>> = ({
  mutation,
  hasExistingImage,
}) => {
  const { t } = useTranslation()
  const { confirm } = useDialog()
  const fileInput = createRef<HTMLInputElement>()

  const handleFileChange = async () => {
    const file = fileInput.current?.files?.[0]
    if (file) {
      if (hasExistingImage) {
        const confirmed = await confirm(
          t("confirm-replace-existing-image"),
          t("confirm-replace-existing-image-title"),
        )
        if (!confirmed) {
          // Reset the file input if user cancels
          if (fileInput.current) {
            fileInput.current.value = ""
          }
          return
        }
      }
      await mutation.mutateAsync(file)
    }
  }

  return (
    <div
      className={css`
        margin: 2rem 0rem;
      `}
    >
      <FieldContainer>
        <LabelButton variant="blue" size="medium" htmlFor="image-upload">
          {t("button-text-select-image")}
        </LabelButton>
        <input
          className={css`
            opacity: 0;
          `}
          id="image-upload"
          accept="image"
          ref={fileInput}
          type="file"
          onChange={handleFileChange}
          disabled={mutation.isPending}
        />
      </FieldContainer>
    </div>
  )
}

export default UploadImageForm

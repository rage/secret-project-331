import { css } from "@emotion/css"
import styled from "@emotion/styled"
import React, { createRef, useState } from "react"
import { useTranslation } from "react-i18next"

import Button, { LabelButton } from "@/shared-module/common/components/Button"

const FieldContainer = styled.div`
  margin-bottom: 1rem;
`

export interface UploadImageFormProps {
  onSubmit: (data: File) => Promise<void>
}

const UploadImageForm: React.FC<React.PropsWithChildren<UploadImageFormProps>> = ({ onSubmit }) => {
  const { t } = useTranslation()
  const fileInput = createRef<HTMLInputElement>()
  const [allowSubmit, setAllowSubmit] = useState(true)
  const [showUploadButton, setShowUploadButton] = useState(false)

  const uploadImage = () => {
    const file = fileInput.current?.files?.[0]
    if (file) {
      setAllowSubmit(false)
      onSubmit(file).finally(() => setAllowSubmit(true))
    }
  }

  return (
    <div
      className={css`
        margin: 2rem 0rem;
      `}
    >
      <FieldContainer>
        {/* eslint-disable-next-line i18next/no-literal-string */}
        <LabelButton htmlFor="image-upload">{t("button-text-select-image")}</LabelButton>
        <input
          className={css`
            opacity: 0;
          `}
          id="image-upload"
          accept="image"
          ref={fileInput}
          type="file"
          onChange={() => setShowUploadButton(true)}
        />
      </FieldContainer>
      {showUploadButton && (
        <div>
          <Button size="medium" variant="primary" onClick={uploadImage} disabled={!allowSubmit}>
            {t("button-text-upload-image")}
          </Button>
        </div>
      )}
    </div>
  )
}

export default UploadImageForm

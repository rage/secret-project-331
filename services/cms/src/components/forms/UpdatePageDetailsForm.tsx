"use client"

import { css } from "@emotion/css"
import styled from "@emotion/styled"
import React, { useEffect } from "react"
import { useForm, useWatch } from "react-hook-form"

import { TextField } from "@/shared-module/components"
import { useTranslation } from "@/utils/useCmsTranslation"

const FieldContainer = styled.div`
  margin-bottom: 1rem;
`

interface UpdatePageDetailsFormFields {
  title: string
}

const TITLE_FIELD_NAME = "title"

interface UpdatePageDetailsFormProps {
  title: string
  setTitle: (newTitle: string) => void
}

const UpdatePageDetailsForm: React.FC<React.PropsWithChildren<UpdatePageDetailsFormProps>> = ({
  title,
  setTitle,
}) => {
  const { t } = useTranslation()
  const { control } = useForm<UpdatePageDetailsFormFields>({ defaultValues: { title } })
  const watchedTitle = useWatch({ control, name: TITLE_FIELD_NAME })

  useEffect(() => {
    setTitle(watchedTitle)
  }, [watchedTitle, setTitle])

  return (
    <div
      className={css`
        padding: 1rem 0;
      `}
    >
      <div>
        <FieldContainer>
          <TextField
            name={TITLE_FIELD_NAME}
            control={control}
            isRequired
            label={t("label-title")}
          />
        </FieldContainer>
      </div>
    </div>
  )
}

export default UpdatePageDetailsForm

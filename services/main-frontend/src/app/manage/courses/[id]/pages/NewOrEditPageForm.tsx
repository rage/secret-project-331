"use client"

import { css } from "@emotion/css"
import styled from "@emotion/styled"
import React, { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"

import {
  createPageMutation as createPageMutationOptions,
  updatePageDetailsMutation as updatePageDetailsMutationOptions,
} from "@/generated/api/@tanstack/react-query.generated"
import type { CreatePageData, Page } from "@/generated/api/types.generated"
import TextField from "@/shared-module/common/components/InputFields/TextField"
import StandardDialog from "@/shared-module/common/components/dialogs/StandardDialog"
import useToastMutationOptions from "@/shared-module/common/hooks/useToastMutationOptions"
import { normalizePath } from "@/utils/normalizePath"

const PathFieldWithPrefixElement = styled.div`
  display: flex;
  align-items: center;
  width: 100%;
`

const FieldContainer = styled.div`
  margin-bottom: 1rem;
  width: 100%;
`

interface NewOrEditPageFormProps {
  courseId: string
  onSubmitForm: () => void
  chapterId?: string
  prefix?: string
  isUpdate: boolean
  savedPage?: Page
  open: boolean
  onClose: () => void
}

type NewPage = CreatePageData["body"]

const NewOrEditPageForm: React.FC<React.PropsWithChildren<NewOrEditPageFormProps>> = ({
  courseId,
  onSubmitForm,
  chapterId,
  prefix = "/",
  isUpdate = false,
  savedPage,
  open,
  onClose,
}) => {
  const { t } = useTranslation()
  const initialPath = useMemo(() => {
    const prevPath = savedPage?.url_path
    if (!prevPath) {
      return ""
    }
    return prevPath.replace(prefix, "")
  }, [prefix, savedPage?.url_path])
  const [path, setPath] = useState(initialPath)
  const [title, setTitle] = useState(savedPage?.title ?? "")

  const createPageMutation = useToastMutationOptions(
    createPageMutationOptions(),
    {
      notify: true,
      method: "POST",
    },
    {
      onSuccess: () => onSubmitForm(),
    },
  )
  const updatePageDetailsMutation = useToastMutationOptions(
    updatePageDetailsMutationOptions(),
    {
      notify: true,
      method: "PUT",
    },
    {
      onSuccess: () => onSubmitForm(),
    },
  )
  const isPending = createPageMutation.isPending || updatePageDetailsMutation.isPending

  const handleSubmit = async () => {
    if (isUpdate) {
      if (!savedPage) {
        throw new Error("Saved page is missing")
      }

      await updatePageDetailsMutation.mutateAsync({
        path: {
          page_id: savedPage.id,
        },
        body: {
          title,
          url_path: `${prefix}${path}`,
        },
      })
      return
    }

    const newPage: NewPage = {
      course_id: courseId,
      content: [],
      url_path: `${prefix}${path}`,
      title,
      chapter_id: chapterId ?? null,
      front_page_of_chapter_id: null,
      exercises: [],
      exercise_slides: [],
      exercise_tasks: [],
      exam_id: null,
      content_search_language: null,
    }

    await createPageMutation.mutateAsync({
      body: newPage,
    })
  }

  return (
    <StandardDialog
      open={open}
      onClose={onClose}
      title={isUpdate ? t("heading-edit-page") : t("heading-new-page")}
      buttons={[
        {
          disabled: isPending,

          variant: "primary",
          onClick: () => {
            void handleSubmit()
          },
          children: isUpdate ? t("button-text-update") : t("button-text-create"),
        },
      ]}
    >
      <div>
        <div>
          <FieldContainer
            className={css`
              margin-left: 4px;
            `}
          >
            <TextField
              required
              label={t("text-field-label-title")}
              value={title}
              onChangeByValue={(value) => {
                setTitle(value)
                setPath(normalizePath(value))
              }}
            />
          </FieldContainer>
          <FieldContainer
            className={css`
              margin-left: -4px;
            `}
          >
            <PathFieldWithPrefixElement>
              <span
                className={css`
                  margin-right: 0.5rem;
                  white-space: nowrap;
                  position: relative;
                  top: 0px;
                `}
              >
                {prefix}
              </span>
              <TextField
                required
                label={t("text-field-label-path")}
                value={path}
                className={css`
                  width: 100%;
                `}
                onChangeByValue={(value) => {
                  setPath(value)
                }}
              />
            </PathFieldWithPrefixElement>
          </FieldContainer>
        </div>
      </div>
    </StandardDialog>
  )
}

export default NewOrEditPageForm

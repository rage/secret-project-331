"use client"

import { css } from "@emotion/css"
import styled from "@emotion/styled"
import React, { useEffect, useMemo, useRef } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import {
  createPageMutation as createPageMutationOptions,
  updatePageDetailsMutation as updatePageDetailsMutationOptions,
} from "@/generated/api/@tanstack/react-query.generated"
import type { CreatePageData, Page } from "@/generated/api/types.generated"
import useToastMutationOptions from "@/shared-module/common/hooks/useToastMutationOptions"
import { Dialog, TextField } from "@/shared-module/components"
import { cleanUrlPath, normalizePath } from "@/utils/normalizePath"

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

interface PageDetailsFields {
  title: string
  path: string
}

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
  const { control, watch, setValue, getValues } = useForm<PageDetailsFields>({
    defaultValues: { title: savedPage?.title ?? "", path: initialPath },
  })
  const title = watch("title")
  const path = watch("path")

  // Deriving the path from the title is a convenience for a fresh edit, not a rule the initial
  // (possibly hand-picked) path must obey, so this skips the render that fires from the seeded value.
  const skipNextTitleDerivedPath = useRef(true)
  useEffect(() => {
    if (skipNextTitleDerivedPath.current) {
      skipNextTitleDerivedPath.current = false
      return
    }
    setValue("path", normalizePath(title))
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [title])

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
      hidden: false,
    }

    await createPageMutation.mutateAsync({
      body: newPage,
    })
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={isUpdate ? t("heading-edit-page") : t("heading-new-page")}
      actions={[
        {
          disabled: isPending,
          variant: "primary",
          onClick: () => {
            void handleSubmit()
          },
          label: isUpdate ? t("button-text-update") : t("button-text-create"),
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
              isRequired
              name="title"
              control={control}
              label={t("text-field-label-title")}
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
              <div
                // React's onBlur bubbles from the input (unlike the native blur event), so this
                // wrapper is what lets the cleanup run without the field exposing an onBlur prop.
                onBlur={() => setValue("path", cleanUrlPath(getValues("path")))}
                className={css`
                  width: 100%;
                `}
              >
                <TextField
                  isRequired
                  name="path"
                  control={control}
                  label={t("text-field-label-path")}
                />
              </div>
            </PathFieldWithPrefixElement>
          </FieldContainer>
        </div>
      </div>
    </Dialog>
  )
}

export default NewOrEditPageForm

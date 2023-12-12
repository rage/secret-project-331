import { css } from "@emotion/css"
import styled from "@emotion/styled"
import React, { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"

import { postNewPage, updatePageDetails } from "../../../../../../services/backend/pages"
import { Page } from "../../../../../../shared-module/bindings"
import Button from "../../../../../../shared-module/components/Button"
import TextField from "../../../../../../shared-module/components/InputFields/TextField"
import useToastMutation from "../../../../../../shared-module/hooks/useToastMutation"
import { normalizePath } from "../../../../../../utils/normalizePath"

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
}

const NewOrEditPageForm: React.FC<React.PropsWithChildren<NewOrEditPageFormProps>> = ({
  courseId,
  onSubmitForm,
  chapterId,
  prefix = "/",
  isUpdate = false,
  savedPage,
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

  const saveMutation = useToastMutation(
    async () => {
      if (isUpdate) {
        if (!savedPage) {
          throw new Error("Saved page is missing")
        }
        await updatePageDetails(savedPage.id, { title, url_path: `${prefix}${path}` })
      } else {
        await postNewPage({
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
        })
      }
      onSubmitForm()
    },
    {
      notify: true,
      method: isUpdate ? "PUT" : "POST",
    },
  )

  return (
    <div
      className={css`
        width: 500px;
        padding: 1rem 0;
      `}
    >
      <div>
        <FieldContainer>
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
        <FieldContainer>
          <PathFieldWithPrefixElement>
            <span
              className={css`
                margin-right: 0.5rem;
                white-space: nowrap;
                position: relative;
                top: 4px;
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
      <div>
        <Button
          disabled={saveMutation.isPending}
          variant="primary"
          size="medium"
          onClick={() => saveMutation.mutate()}
        >
          {isUpdate ? t("button-text-update") : t("button-text-create")}
        </Button>
      </div>
    </div>
  )
}

export default NewOrEditPageForm

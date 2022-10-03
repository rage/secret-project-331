import { css } from "@emotion/css"
import styled from "@emotion/styled"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import { postNewPage } from "../../../../../../services/backend/pages"
import Button from "../../../../../../shared-module/components/Button"
import TextField from "../../../../../../shared-module/components/InputFields/TextField"
import { normalizePath } from "../../../../../../utils/normalizePath"

const PathFieldWithPrefixElement = styled.div`
  display: flex;
  align-items: center;
`

const FieldContainer = styled.div`
  margin-bottom: 1rem;
`

interface NewPageFormProps {
  courseId: string
  onSubmitForm: () => void
  chapterId?: string
  prefix?: string
}

const NewPageForm: React.FC<React.PropsWithChildren<NewPageFormProps>> = ({
  courseId,
  onSubmitForm,
  chapterId,
  prefix = "/",
}) => {
  const { t } = useTranslation()
  const [path, setPath] = useState("")
  const [title, setTitle] = useState("")

  const createNewPage = async () => {
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
    onSubmitForm()
  }

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
            onChange={(value) => {
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
              onChange={(value) => {
                setPath(value)
              }}
            />
          </PathFieldWithPrefixElement>
        </FieldContainer>
      </div>
      <div>
        <Button variant="primary" size="medium" onClick={createNewPage}>
          {t("button-text-create")}
        </Button>
      </div>
    </div>
  )
}

export default NewPageForm

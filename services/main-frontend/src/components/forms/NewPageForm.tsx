import { css } from "@emotion/css"
import styled from "@emotion/styled"
import { TextField } from "@material-ui/core"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import { postNewPage } from "../../services/backend/pages"
import Button from "../../shared-module/components/Button"
import { normalizePath } from "../../utils/normalizePath"

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

const NewPageForm: React.FC<NewPageFormProps> = ({
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
            fullWidth
            id="outlined-required"
            label={t("text-field-label-title")}
            variant="outlined"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value)
              setPath(normalizePath(e.target.value))
            }}
          />
        </FieldContainer>
        <FieldContainer>
          <PathFieldWithPrefixElement>
            <span
              className={css`
                margin-right: 0.5rem;
                white-space: nowrap;
              `}
            >
              {prefix}
            </span>
            <TextField
              required
              fullWidth
              id="outlined-required"
              label={t("text-field-label-path")}
              variant="outlined"
              value={path}
              onChange={(e) => {
                setPath(e.target.value)
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

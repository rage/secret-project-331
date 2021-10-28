import { css } from "@emotion/css"
import styled from "@emotion/styled"
import { TextField } from "@material-ui/core"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import { postNewChapter } from "../../services/backend/chapters"
import Button from "../../shared-module/components/Button"

const StyledTextField = styled(TextField)`
  margin: 0.3rem;
`
const StyledButton = styled(Button)`
  margin: 0.3rem;
`

const FieldContainer = styled.div`
  margin-bottom: 1rem;
`

interface NewChapterFormProps {
  courseId: string
  onSubmitForm: () => void
  chapterNumber: number
}

const NewChapterForm: React.FC<NewChapterFormProps> = ({
  courseId,
  onSubmitForm,
  chapterNumber,
}) => {
  const { t } = useTranslation()
  const [chapter, setChapter] = useState<number | undefined>(chapterNumber)
  const [name, setName] = useState<string>("")

  const createNewChapter = async () => {
    if (chapter !== undefined) {
      await postNewChapter({
        course_id: courseId,
        name: name,
        chapter_number: chapter,
        front_front_page_id: null,
      })
      onSubmitForm()
    }
  }

  return (
    <div
      className={css`
        padding: 1rem 0;
      `}
    >
      <div>
        <FieldContainer>
          <StyledTextField
            required
            id="outlined-required"
            fullWidth
            label={t("text-field-label-name")}
            variant="outlined"
            value={name}
            onChange={(e) => {
              setName(e.target.value)
            }}
          />
        </FieldContainer>
        <FieldContainer>
          <StyledTextField
            required
            id="outlined-required"
            fullWidth
            label={t("text-field-label-chapter-number")}
            variant="outlined"
            type="number"
            value={chapter}
            onChange={(e) => {
              setChapter(Number(e.target.value))
            }}
          />
        </FieldContainer>
      </div>
      <div>
        <StyledButton variant="primary" size="medium" onClick={createNewChapter}>
          {t("button-text-create")}
        </StyledButton>
      </div>
    </div>
  )
}

export default NewChapterForm

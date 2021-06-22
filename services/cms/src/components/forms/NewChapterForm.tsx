import { css } from "@emotion/css"
import styled from "@emotion/styled"
import { Button, TextField } from "@material-ui/core"
import React, { useState } from "react"
import { postNewChapter } from "../../services/backend/chapters"

const StyledTextField = styled(TextField)`
  margin: 0.3rem;
`
const StyledButton = styled(Button)`
  margin: 0.3rem;
`

const FieldContainer = styled.div`
  margin-bottom: 1rem;
`

interface NewPartFormProps {
  courseId: string
  onSubmitForm: () => void
  chapterNumber: number
}

const NewPartForm: React.FC<NewPartFormProps> = ({ courseId, onSubmitForm, chapterNumber }) => {
  const [chapter, setChapter] = useState<number | undefined>(chapterNumber)
  const [name, setName] = useState<string>("")

  const createNewChapter = async () => {
    if (chapter !== undefined) {
      await postNewChapter({
        course_id: courseId,
        name: name,
        chapter_number: chapter,
        page_id: null,
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
            label="Name"
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
            label="Chapter number"
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
        <StyledButton onClick={createNewChapter}>Create chapter</StyledButton>
      </div>
    </div>
  )
}

export default NewPartForm

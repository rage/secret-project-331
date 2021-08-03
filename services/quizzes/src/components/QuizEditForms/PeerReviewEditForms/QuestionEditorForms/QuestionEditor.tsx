import { FormControlLabel, FormGroup, MenuItem, Switch, TextField } from "@material-ui/core"
import React from "react"
import { useDispatch } from "react-redux"
import styled from "styled-components"

import {
  editedPeerReviewQuestionBody,
  editedPeerReviewQuestionTitle,
  editedPeerReviewQuestionType,
  toggledQuestionAnswerRequired,
  toggledQuestionDefault,
} from "../../../../store/editor/questions/questionActions"
import { useTypedSelector } from "../../../../store/store"
import MarkdownEditor from "../../../MarkdownEditor"

const PRQWrapper = styled.div`
  display: flex;
  width: 100%;
  flex-wrap: wrap;
`

const PRQTextfield = styled(TextField)`
  display: flex;
  margin-top: 0.5rem !important;
  margin-bottom: 0.5rem !important;
`

interface PRQEditorProps {
  id: string
}

export const QuestionEditor: React.FC<PRQEditorProps> = ({ id }) => {
  const dispatch = useDispatch()
  const prq = useTypedSelector((state) => state.editor.questions[id])
  return (
    <PRQWrapper>
      <MarkdownEditor
        label="Question title"
        text={prq.title ?? ""}
        onChange={(event) => dispatch(editedPeerReviewQuestionTitle(event.target.value, id))}
      />
      <MarkdownEditor
        label="Question body"
        text={prq.body ?? ""}
        onChange={(event) => dispatch(editedPeerReviewQuestionBody(event.target.value, id))}
      />
      <PRQTextfield
        label="Question type"
        select
        variant="outlined"
        fullWidth
        value={prq.type}
        onChange={(event) => dispatch(editedPeerReviewQuestionType(event.target.value, id))}
      >
        <MenuItem value="grade">grade</MenuItem>
        <MenuItem value="essay">essay</MenuItem>
      </PRQTextfield>
      <FormGroup row>
        <FormControlLabel
          control={
            <Switch
              checked={prq.default}
              onChange={(event) => dispatch(toggledQuestionDefault(prq.id, event.target.checked))}
              name="default"
            />
          }
          label="Default"
          labelPlacement="end"
        />
        <FormControlLabel
          control={
            <Switch
              checked={prq.answerRequired}
              onChange={(event) =>
                dispatch(toggledQuestionAnswerRequired(prq.id, event.target.checked))
              }
              name="answer required"
            />
          }
          label="Answer required"
          labelPlacement="end"
        />
      </FormGroup>
    </PRQWrapper>
  )
}

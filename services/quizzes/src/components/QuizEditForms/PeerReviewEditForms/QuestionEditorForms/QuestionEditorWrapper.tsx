import { faAngleDown, faAngleUp, faTrash } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { Button, Divider } from "@material-ui/core"
import React from "react"
import { useDispatch } from "react-redux"
import styled from "styled-components"

import {
  createdNewPeerReviewQuestion,
  decreasedPRQOrder,
  deletedPRQ,
  increasedPRQOrder,
} from "../../../../store/editor/questions/questionActions"
import { useTypedSelector } from "../../../../store/store"

import { QuestionEditor } from "./QuestionEditor"

const StyledPRQEditor = styled.div`
  display: flex;
  width: 100%;
  flex-wrap: wrap;
  justify-content: center;
`

const StyledDivider = styled(Divider)`
  display: flex !important;
  margin-top: 1rem !important;
  margin-bottom: 1rem !important;
  width: 100% !important;
`

const PeerReviewTitleWrapper = styled.div`
  display: flex !important;
  width: 100%;
  justify-content: center;
  margin-bottom: 1rem;
`

const AddPRQButtonWrapper = styled.div`
  display: flex;
  width: 100%;
  justify-content: space-around;
  margin-top: 1rem;
  margin-bottom: 1rem;
  flex-wrap: wrap;
`

const AddPRQButton = styled(Button)`
  display: flex !important;
  width: 33% !important;
  background: #e0e0e0 !important;
  margin-bottom: 1rem !important;
  @media only screen and (max-width: 600px) {
    width: 100% !important;
  }
`
const QuestionContainer = styled.div`
  display: flex;
  width: 90%;
  justify-content: center;
  flex-wrap: wrap;
`

const QuestionTitleWrapper = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
`
interface QuestionEditorWrapperProps {
  peerReviewId: string
}

export const QuestionEditorWrapper: React.FC<QuestionEditorWrapperProps> = ({ peerReviewId }) => {
  const peerReviewQuestions = Object.values(useTypedSelector((state) => state.editor.questions))

  const filteredQuestions = peerReviewQuestions.filter(
    (question) => question.peerReviewCollectionId === peerReviewId,
  )

  filteredQuestions.sort((a, b) => a.order - b.order)

  const quizId = useTypedSelector((state) => state.editor.quizId)
  const dispatch = useDispatch()
  return (
    <>
      <StyledPRQEditor>
        <PeerReviewTitleWrapper>
          <h4>Peer review questions</h4>
        </PeerReviewTitleWrapper>
        {filteredQuestions.map((question, index) => {
          return (
            <QuestionContainer key={question.id}>
              <QuestionTitleWrapper>
                <p>Peer review question nro. {index + 1}</p>
                <Button onClick={() => dispatch(decreasedPRQOrder(question.id))}>
                  <FontAwesomeIcon icon={faAngleUp} size="2x" />
                </Button>
                <Button onClick={() => dispatch(increasedPRQOrder(question.id))}>
                  <FontAwesomeIcon icon={faAngleDown} size="2x" />
                </Button>
                <Button
                  title="delete question"
                  onClick={() => dispatch(deletedPRQ(question.id, question.peerReviewCollectionId))}
                >
                  <FontAwesomeIcon icon={faTrash} size="2x" color="red" />
                </Button>
              </QuestionTitleWrapper>
              <QuestionEditor key={question.id} id={question.id} />
              <StyledDivider variant="fullWidth" />
            </QuestionContainer>
          )
        })}
        <PeerReviewTitleWrapper>
          <h4>Add peer review question</h4>
        </PeerReviewTitleWrapper>
        <AddPRQButtonWrapper>
          <AddPRQButton
            variant="outlined"
            onClick={() => dispatch(createdNewPeerReviewQuestion(quizId, peerReviewId, "grade"))}
          >
            <p>Grade</p>
          </AddPRQButton>
          <AddPRQButton
            variant="outlined"
            onClick={() => dispatch(createdNewPeerReviewQuestion(quizId, peerReviewId, "essay"))}
          >
            <p>Essay</p>
          </AddPRQButton>
          <StyledDivider />
        </AddPRQButtonWrapper>
      </StyledPRQEditor>
    </>
  )
}

export default QuestionEditorWrapper

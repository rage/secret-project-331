import React from "react"
import { useDispatch } from "react-redux"

import {
  editedPeerReviewBody,
  editedPeerReviewTitle,
} from "../../../store/editor/peerReviewCollections/peerReviewCollectionActions"
import { useTypedSelector } from "../../../store/store"
import MarkdownEditor from "../../MarkdownEditor"

import QuestionEditorWrapper from "./QuestionEditorForms/QuestionEditorWrapper"

interface PeerReviewEditorProps {
  id: string
}

export const PeerReviewEditor: React.FC<PeerReviewEditorProps> = ({ id }) => {
  const peerReview = useTypedSelector((state) => state.editor.peerReviewCollections[id])
  const dispatch = useDispatch()

  return (
    <>
      <MarkdownEditor
        label="Peer review title"
        text={peerReview.title ?? ""}
        onChange={(event) => {
          dispatch(editedPeerReviewTitle(id, event.target.value))
        }}
      />
      <MarkdownEditor
        label="Peer review body"
        text={peerReview.body ?? ""}
        onChange={(event) => {
          dispatch(editedPeerReviewBody(id, event.target.value))
        }}
      />
      <QuestionEditorWrapper peerReviewId={id} />
    </>
  )
}

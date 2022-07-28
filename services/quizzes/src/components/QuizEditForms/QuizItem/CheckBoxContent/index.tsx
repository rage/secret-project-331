import styled from "@emotion/styled"
import { faTrash, faWindowClose } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { Fade } from "@mui/material"
import React from "react"
import { useTranslation } from "react-i18next"
import { useDispatch } from "react-redux"

import { NormalizedQuizItem } from "../../../../../types/types"
import { deletedItem } from "../../../../store/editor/editorActions"
import { setAdvancedEditing } from "../../../../store/editor/itemVariables/itemVariableActions"
import { editedQuizItemTitle } from "../../../../store/editor/items/itemAction"
import { useTypedSelector } from "../../../../store/store"
import MarkdownEditor from "../../../MarkdownEditor"
import {
  AdvancedBox,
  AdvancedBoxModalOpenClass,
  CloseButton,
  DeleteButton,
  ModalButtonWrapper,
  StyledModal,
} from "../../../Shared/Modal"

import CheckBoxModalContent from "./CheckBoxModalContent"

interface ContentBoxProps {
  item: NormalizedQuizItem
}

const Container = styled.div`
  padding: 1rem;
`
const CheckBoxContent: React.FC<React.PropsWithChildren<ContentBoxProps>> = ({ item }) => {
  const { t } = useTranslation()
  const storeItem = useTypedSelector((state) => state.editor.items[item.id])
  const quizId = useTypedSelector((state) => state.editor.quizId)
  const variables = useTypedSelector((state) => state.editor.itemVariables[item.id])
  item.timelineItems
  const dispatch = useDispatch()
  return (
    <>
      <StyledModal
        open={variables.advancedEditing}
        onClose={() => dispatch(setAdvancedEditing({ itemId: storeItem.id, editing: false }))}
      >
        <Fade in={variables.advancedEditing}>
          <AdvancedBox
            className={AdvancedBoxModalOpenClass(variables.advancedEditingYAxisLocation)}
          >
            <ModalButtonWrapper>
              <CloseButton
                aria-label={t("close")}
                onClick={() =>
                  dispatch(setAdvancedEditing({ itemId: storeItem.id, editing: false }))
                }
              >
                <FontAwesomeIcon icon={faWindowClose} size="2x" />
              </CloseButton>
            </ModalButtonWrapper>
            <CheckBoxModalContent itemId={storeItem.id} />
            <ModalButtonWrapper>
              <DeleteButton
                onClick={() => {
                  dispatch(deletedItem(storeItem.id, quizId))
                }}
              >
                {/* eslint-disable-next-line i18next/no-literal-string */}
                <FontAwesomeIcon icon={faTrash} size="2x" color="red" />
              </DeleteButton>
            </ModalButtonWrapper>
          </AdvancedBox>
        </Fade>
      </StyledModal>
      <Container>
        <div>
          <MarkdownEditor
            label={t("title")}
            onChange={(value) => dispatch(editedQuizItemTitle(value, storeItem.id))}
            text={storeItem.title ?? ""}
          />
        </div>
      </Container>
    </>
  )
}

export default CheckBoxContent

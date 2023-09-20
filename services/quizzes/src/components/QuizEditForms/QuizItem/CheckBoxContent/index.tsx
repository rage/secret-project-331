import styled from "@emotion/styled"
import { Fade } from "@mui/material"
import { Trash, XmarkCircle } from "@vectopus/atlas-icons-react"
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
                <XmarkCircle size={28} />
              </CloseButton>
            </ModalButtonWrapper>
            <CheckBoxModalContent itemId={storeItem.id} />
            <ModalButtonWrapper>
              <DeleteButton
                onClick={() => {
                  dispatch(deletedItem(storeItem.id, quizId))
                }}
              >
                <Trash size={28} color="red" />
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

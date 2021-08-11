import { Checkbox, TextField } from "@material-ui/core"
import React from "react"
import { useDispatch } from "react-redux"
import styled from "styled-components"

import { editedQuizItemTitle } from "../../../../store/editor/items/itemAction"
import { useTypedSelector } from "../../../../store/store"
import { ModalWrapper } from "../../../Shared/Modal"

const Container = styled.div`
  display: flex;
  padding: 1rem;
  justify-content: space-between;
`

const TitleField = styled.div`
  display: flex;
  width: 50%;
`

const PreviewField = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  width: 50%;
`

const StyledCheckBox = styled(Checkbox)`
  display: flex;
  justify-content: flex-end;
  width: 20%;
`

const CheckBoxTitleField = styled.div`
  display: flex;
  width: 80%;
`

const StyledTypo = styled.h4`
  display: flex;
  align-self: flex-start;
`
interface CheckBoxModalProps {
  itemId: string
}

export const CheckBoxModalContent: React.FC<CheckBoxModalProps> = ({ itemId }) => {
  const dispatch = useDispatch()
  const storeItem = useTypedSelector((state) => state.editor.items[itemId])
  return (
    <ModalWrapper>
      <Container>
        <TitleField>
          <TextField
            label="title"
            fullWidth
            multiline
            value={storeItem.title ?? ""}
            variant="outlined"
            onChange={(event) => dispatch(editedQuizItemTitle(event.target.value, storeItem.id))}
          />
        </TitleField>
        <PreviewField>
          <StyledCheckBox disableRipple={true} disableFocusRipple={true} />
          <CheckBoxTitleField>
            <StyledTypo>{storeItem.title}</StyledTypo>
          </CheckBoxTitleField>
        </PreviewField>
      </Container>
    </ModalWrapper>
  )
}

export default CheckBoxModalContent

import styled from "@emotion/styled"
import { faArrowDown, faArrowUp, faTrash } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import React from "react"

import Button from "../../../../shared-module/components/Button"

interface EditorCardProps {
  title: string
}

const EditorWrapper = styled.div`
  border: 2px solid #e3e3e3;
`

const EditorTitle = styled.div`
  font-size: 20px;
  color: #333333;
  font-weight: bold;
  display: inline;
  margin-right: 16px;
`

const EditorSection = styled.div`
  padding: 16px;
  border-bottom: 2px solid #e3e3e3;
  width: 100%;
`

const CircleButton = styled(FontAwesomeIcon)`
  border: 1px solid #e3e3e3;
  height: 12px;
  width: 12px;
  padding: 4px;
  display: inline;
  border-radius: 50%;
  cursor: pointer;
  margin-left: 2px;

  :hover {
    border: 1px solid #ababab;
    background-color: #c9c9c9;
  }
`

const EditorContent = styled.div`
  padding: 16px;
`

const DeleteButtonContainer = styled.div`
  display: flex;
  align-items: flex-end;
  justify-content: flex-end;
`

const DeleteButton = styled(Button)`
  margin-bottom: 8px;
  margin-right: 8px;
`

const EditorCard: React.FC<React.PropsWithChildren<EditorCardProps>> = ({ children, title }) => {
  return (
    <EditorWrapper>
      <EditorSection>
        <EditorTitle>{title}</EditorTitle>
        <CircleButton icon={faArrowUp} />
        <CircleButton icon={faArrowDown} />
      </EditorSection>
      <EditorContent>{children}</EditorContent>
      <DeleteButtonContainer>
        <DeleteButton size="medium" variant="outlined">
          <FontAwesomeIcon icon={faTrash} />
        </DeleteButton>
      </DeleteButtonContainer>
    </EditorWrapper>
  )
}

export default EditorCard

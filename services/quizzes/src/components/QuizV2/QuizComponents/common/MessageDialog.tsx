import styled from "@emotion/styled"
import React, { useRef } from "react"

interface MessageDialogProps {
  title: string
  description: string
}

const MessageDialogContainer = styled.div`
  display: flex;
  flex-direction: column;
  background-color: #f7f8f9;
`

const MessageDialogTitle = styled.div`
  background-color: #dae6e5;
  color: #44827e;
  font-size: 17px;
  font-weight: bold;
  width: 100%;
  height: 40px;
  padding: 8px 0px 0px 16px;
`

const MessageDialogDescription = styled.div`
  color: #535a66;
  padding: 16px;
  height: 60px;
`

const MessageDialog: React.FC<MessageDialogProps> = ({ title, description }) => {
  const textEl = useRef<HTMLDivElement>(null)

  return (
    <MessageDialogContainer>
      <MessageDialogTitle>{title}</MessageDialogTitle>
      <MessageDialogDescription>
        <div
          contentEditable={true}
          ref={textEl}
          suppressContentEditableWarning={true}
          onInput={() => {
            // textEl.current.textContent = event.target.textContent
            // onChangeDescription(textEl.current.textContent)
          }}
        >
          {description}
        </div>
      </MessageDialogDescription>
    </MessageDialogContainer>
  )
}

export default MessageDialog

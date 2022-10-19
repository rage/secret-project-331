import styled from "@emotion/styled"
import React from "react"

interface MessageModelProps {
  title: string
  description: string
}

const MessageModalContainer = styled.div`
  display: flex;
  flex-direction: column;
  background-color: #f7f8f9;
`

const MessageModalTitle = styled.div`
  background-color: #dae6e5;
  color: #44827e;
  font-size: 17px;
  font-weight: bold;
  width: 100%;
  height: 40px;
  padding: 8px 0px 0px 16px;
`

const MessageModalDescription = styled.div`
  color: #535a66;
  padding: 16px;
  height: 60px;
`

const MessageModel: React.FC<MessageModelProps> = ({ title, description }) => {
  return (
    <MessageModalContainer>
      <MessageModalTitle>{title}</MessageModalTitle>
      <MessageModalDescription>{description}</MessageModalDescription>
    </MessageModalContainer>
  )
}

export default MessageModel

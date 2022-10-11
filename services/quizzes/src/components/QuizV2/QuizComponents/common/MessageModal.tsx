import styled from '@emotion/styled'
import React from 'react'

interface MessageModelProps {
  title: string
  description: string
}

const MessageModalContainer = styled.div`
  display: flex;
  flex-direction: column;
  background-color: #F7F8F9;
`

const MessageModalTitle = styled.div`
  background-color: #DAE6E5;
  color: #44827E;
  font-size: 17px;
  font-weight: bold;
  width: 100%;
  height: 40px;
  padding: 8px 0px 0px 16px;
`

const MessageModalDescription = styled.div`
  color: #535A66;
  padding: 16px;
  height: 60px;
`

const MessageModel: React.FC<MessageModelProps> = ({
  title,
  description
}) => {
  return (
    <MessageModalContainer>
      <MessageModalTitle>
        { title }
      </MessageModalTitle>
      <MessageModalDescription>
        { description }
      </MessageModalDescription>
    </MessageModalContainer>
  )
}

export default MessageModel

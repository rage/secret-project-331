/* eslint-disable i18next/no-literal-string */
import { css } from "@emotion/css"
import styled from "@emotion/styled"
import { Fragment, useState } from "react"

import TextAreaField from "../InputFields/TextAreaField"

const Wrapper = styled.div`
  width: 100%;
  height: auto;
`
const Header = styled.div`
  display: flex;
  justify-content: space-between;
  padding: 2rem 2rem 1.6rem 2rem;

  h2 {
    align-self: end;
  }
`
const Tag = styled.div`
  background: #ececec;
  width: auto;
  padding: 1rem;
  text-transform: uppercase;
`
const Content = styled.div`
  padding: 0 2rem;
`
const Text = styled.p`
  font-size: 20px;
  line-height: 140%;
  font-weight: 500;
  padding-bottom: 0rem;
`
const Footer = styled.div`
  display: flex;
  justify-content: space-between;
  padding: 1.5rem 0 3rem 0;
  align-items: center;
`
const Author = styled.div`
  display: flex;

  span {
    margin-right: 10px;
    color: #535a66;
    font-size: 20px;
    align-self: center;
  }
`
const ActionTab = styled.div`
  display: flex;
`
const ChatIcon = styled.div`
  display: flex;
`
const PlaceholderAvatar = styled.div`
  background: #f3f3f3;
  border-radius: 100%;
  height: 35px;
  width: 35px;
  margin-right: 10px;
`
const PlaceholderIcon = styled.div`
  background: #f3f3f3;
  border-radius: 100%;
  height: 30px;
  width: 30px;
  margin-right: 10px;
`
const StyledReplyIcon = styled.div`
  display: flex;
  margin: 0 1.5rem;
  cursor: pointer;

  span {
    color: #535a66;
  }
`
const StyledReportIcon = styled.span`
  color: #b66757;
`
const TimeLabel = styled.span`
  color: #535a66;
`
interface Item {
  id: string
  text: string
  time: string
}

interface StateProps {
  id: string
  text: string
  time: string
  items?: Item[]
}
interface ThreadProps {
  state: StateProps
  author: string
  onKeyPress?: any
  clicked?: boolean
  selectedId?: string
  handleClick?: any
}
interface Threads extends ThreadProps {
  nested: boolean
}

const Thread = (props: ThreadProps) => {
  const {
    state,
    state: { items },
    author,
    onKeyPress,
    handleClick,
    clicked,
    selectedId,
  } = props
  /*  const [clicked, setClicked] = useState(false) */
  return (
    <Fragment>
      {getThread(state, author, handleClick, onKeyPress, clicked, selectedId)}
      {items?.map((item) => getThread(item, author, null, null, null, null, true))}
    </Fragment>
  )
}

const getThread = (
  state,
  author,
  handleClick,
  onKeyPress,
  clicked,
  selectedId,
  nested = false,
): Threads => {
  const { id, text, time } = state
  return (
    text && (
      <Wrapper
        className={css`
          ${nested && "padding-left: 40px;"}
        `}
        key={text}
      >
        <Header
          className={css`
            ${nested && "padding-top: 0 !important;"}
          `}
        >
          <Author>
            <PlaceholderAvatar></PlaceholderAvatar>
            <span>{author}</span>
          </Author>
          <TimeLabel>{time}</TimeLabel>
        </Header>
        <Content>
          <Text>{text}</Text>
          <Footer>
            <ActionTab>
              <PlaceholderIcon></PlaceholderIcon>
              <PlaceholderIcon></PlaceholderIcon>
              <PlaceholderIcon></PlaceholderIcon>
              <StyledReplyIcon onClick={handleClick}>
                <PlaceholderIcon></PlaceholderIcon>
                <span id={id}>Reply</span>
              </StyledReplyIcon>
              <StyledReportIcon>Report</StyledReportIcon>
            </ActionTab>
            <ChatIcon>
              <PlaceholderIcon></PlaceholderIcon>
            </ChatIcon>
          </Footer>
          {clicked && selectedId === id && (
            <TextAreaField
              name="comment"
              placeholder="leave a comment"
              onChange={() => null}
              onKeyPress={onKeyPress}
            />
          )}
        </Content>
      </Wrapper>
    )
  )
}

export default Thread

import { css } from "@emotion/css"
import styled from "@emotion/styled"
import React, { Fragment } from "react"
import { useTranslation } from "react-i18next"

import TextAreaField from "../InputFields/TextAreaField"

import { Item, Thread as StateProps } from "./Forum"

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
const StyledButton = styled.input`
  display: flex;
  border: none;
  align-self: end;
  padding: 0.5rem 2rem;
  font-size: 18px;
  color: #313947;
  margin: 1rem 0;
`

interface ThreadProps {
  state: StateProps
  author: string
  handleReply?: (e: React.SyntheticEvent) => void
  clicked?: boolean
  selectedId?: string
  handleClick?: (event: React.MouseEvent<HTMLInputElement>) => void
}

const REPLY = "reply"
const SUBMIT = "submit"

const Thread: React.FC<ThreadProps> = (props) => {
  const {
    state: { items },
  } = props

  return (
    <Fragment>
      {GetThread(props)}
      {items?.map((item) => GetNestedThread(item))}
    </Fragment>
  )
}

const GetThread = (props: ThreadProps) => {
  const { t } = useTranslation()
  const { state, author, handleReply, handleClick, clicked, selectedId } = props

  const { id, text, time } = state
  return (
    text && (
      <Wrapper key={text}>
        <Header>
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
                <span id={id}>{t("reply")}</span>
              </StyledReplyIcon>
              <StyledReportIcon>{t("report")}</StyledReportIcon>
            </ActionTab>
            <ChatIcon>
              <PlaceholderIcon></PlaceholderIcon>
            </ChatIcon>
          </Footer>
          {clicked && selectedId === id && (
            <form onSubmit={handleReply}>
              <TextAreaField
                name={REPLY}
                placeholder={t("leave-a-comment")}
                onChange={() => null}
              />
              <StyledButton type="submit" name={SUBMIT} value={t("reply")} />
            </form>
          )}
        </Content>
      </Wrapper>
    )
  )
}

const GetNestedThread = (item: Item) => {
  const { t } = useTranslation()
  const { text, time, author } = item
  return (
    text && (
      <Wrapper
        className={css`
          padding-left: 40px;
        `}
        key={text}
      >
        <Header
          className={css`
            padding-top: 0 !important;
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
              <StyledReportIcon>{t("report")}</StyledReportIcon>
            </ActionTab>
            <ChatIcon>
              <PlaceholderIcon></PlaceholderIcon>
            </ChatIcon>
          </Footer>
        </Content>
      </Wrapper>
    )
  )
}

export default Thread

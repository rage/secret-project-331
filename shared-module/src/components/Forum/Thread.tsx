/* eslint-disable i18next/no-literal-string */
import styled from "@emotion/styled"

const Wrapper = styled.div`
  background: #fff;
  width: 100%;
  height: auto;
  border-radius: 4px;
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

const Thread = () => {
  return (
    <Wrapper>
      <Header>
        <Author>
          <PlaceholderAvatar></PlaceholderAvatar>
          <span>Henrik Nygren</span>
        </Author>
        <TimeLabel>12hr ago</TimeLabel>
      </Header>
      <Content>
        <Text>
          Lorem Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum has
          been the industry's standard dummy text ever since the 1500s, when an unknown printer took
          a galley of type and scrambled it to make a type specimen book. It has survived not only
          five centuries, but also the leap into electronic typesetting, remaining essentially
          unchanged.
        </Text>
        <Footer>
          <ActionTab>
            <PlaceholderIcon></PlaceholderIcon>
            <PlaceholderIcon></PlaceholderIcon>
            <PlaceholderIcon></PlaceholderIcon>
            <StyledReplyIcon>
              <PlaceholderIcon></PlaceholderIcon>
              <span>Reply</span>
            </StyledReplyIcon>
            <StyledReportIcon>Report</StyledReportIcon>
          </ActionTab>
          <ChatIcon>
            <PlaceholderIcon></PlaceholderIcon>
          </ChatIcon>
        </Footer>
      </Content>
    </Wrapper>
  )
}

export default Thread

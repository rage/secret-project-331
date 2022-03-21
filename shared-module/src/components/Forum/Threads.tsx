/* eslint-disable i18next/no-literal-string */
import styled from "@emotion/styled"

const Wrapper = styled.div`
  background: #fff;
  width: 60%;
  height: auto;
  border: 2px solid rgba(205, 205, 205, 0.8);
  border-radius: 4px;
`
const Header = styled.div`
  display: flex;
  justify-content: space-between;
  padding: 2rem 2rem 2rem 2rem;

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
  padding-bottom: 3rem;
  border-bottom: 2px solid rgba(197, 197, 197, 0.8);
`
const Footer = styled.div`
  display: flex;
  justify-content: space-between;
  padding: 1.5rem 0 3rem 0;
  align-items: center;
`
const Author = styled.div`
  display: flex;

  p {
    margin-right: 10px;
    color: #b2b2b2;
    span {
      color: #32bea6;
      margin: 0 10px;
    }
  }
`
const ChatIcon = styled.div`
  display: flex;
`
const PlaceholderAvatar = styled.div`
  background: #f3f3f3;
  border-radius: 100%;
  height: 30px;
  width: 30px;
  margin-right: 10px;
`

const Threads = () => {
  return (
    <Wrapper>
      <Header>
        <h2>New date for final exams</h2>
        <Tag>Computer science</Tag>
      </Header>
      <Content>
        <Text>
          Lorem Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum has
          been the industrys standard dummy text ever since the 1500s, when an unknown printer took
          a galley of type and scrambled it to make a type specimen book. It has survived not only
          five centuries, but also the leap into electronic typesetting, remaining essentially
          unchanged.
        </Text>
        <Footer>
          <Author>
            <PlaceholderAvatar></PlaceholderAvatar>
            <p>
              Posted by <span>Henrik Nygren</span>
            </p>
            <span>12hr ago</span>
          </Author>
          <ChatIcon>
            <PlaceholderAvatar></PlaceholderAvatar>
            <span>50+</span>
          </ChatIcon>
        </Footer>
      </Content>
    </Wrapper>
  )
}

export default Threads

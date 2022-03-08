/* eslint-disable i18next/no-literal-string */
import { css } from "@emotion/css"
import styled from "@emotion/styled"

const arr = [
  { text: "Home", path: "/" },
  { text: "Your threads", path: "/" },
  { text: "Saved", path: "/" },
]
const currentCourse = [
  { text: "Computer science", path: "/" },
  { text: "Biology", path: "/" },
  { text: "Chemistry", path: "/" },
  { text: "Economics", path: "/" },
  { text: "Physics", path: "/" },
  { text: "Computer science", path: "/" },
]

const Wrapper = styled.div`
  display: block;
  position: sticky;
  top: 24px;
  max-width: 400px;
  height: 100vh;
  overflow: auto;
  border-right: 2px solid #c5c5c5;
  padding-left: 1rem;

  ol:first-of-type {
    margin-bottom: 4rem;
  }
  ol:last-of-type {
    margin-bottom: 3rem;
  }

  ol {
    text-decoration: none;
    list-style: none;
    padding-left: 0;

    li {
      display: flex;
      color: #B2B2B;
      margin-bottom: 1rem;
      margin-right: 4rem;
      padding: 0.5rem 0;
      align-items: center;

      &:hover {
        background: red;
      }

      a {
        text-decoration: none;
        color: #1a2333;
        font-weight: 400;
        font-size: 20px;
        line-height: 1.2;
        align-self: center;
        padding-bottom: 0.3rem;
      }
    }
  }
`

const PlaceholderAvatar = styled.div`
  background: #f3f3f3;
  border-radius: 100%;
  height: 40px;
  width: 40px;
  margin-right: 15px;
`

const StyledButton = styled.button`
  display: flex;
  border: none;
  padding: 1rem 1.5rem;
`

const SideNavigation = () => {
  return (
    <Wrapper>
      <ol>
        {arr.map(({ text, path }) => (
          <li key={text}>
            <PlaceholderAvatar></PlaceholderAvatar>
            <a href={path}>{text}</a>
          </li>
        ))}
      </ol>

      <h2>Current course {`(${currentCourse.length})`}</h2>
      <ol>
        {currentCourse.map(({ text, path }) => (
          <li key={text}>
            <PlaceholderAvatar></PlaceholderAvatar>
            <a href={path}>{text}</a>
          </li>
        ))}
      </ol>

      <StyledButton> Join new course</StyledButton>
    </Wrapper>
  )
}

export default SideNavigation

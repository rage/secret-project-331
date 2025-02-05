import styled from "@emotion/styled"
import { useState } from "react"

import { headingFont } from "../../styles"

const arr = [
  { text: "Home", path: "/" },
  { text: "Your threads", path: "/" },
  { text: "Saved", path: "/" },
]
const currentCourse = [
  { id: "001", text: "Computer science", path: "/" },
  { id: "002", text: "Biology", path: "/" },
  {
    id: "003",
    text: "Chemistry",
    path: "/",
    items: [
      { text: "Subtopic", path: "/" },
      { text: "Subtopic threads", path: "/" },
    ],
  },
  {
    id: "004",
    text: "Economics",
    path: "/",
    items: [
      { text: "Subtopic I", path: "/" },
      { text: "Subtopic threads IV", path: "/" },
    ],
  },
  { id: "005", text: "Physics", path: "/" },
  { id: "006", text: "Computer science II", path: "/" },
]

const Wrapper = styled.div`
  display: block;
  position: sticky;
  top: 24px;
  max-width: 450px;
  height: 100vh;
  overflow: auto;
  border-right: 2px solid #cfcfcf;
  padding-left: 2rem;
  background: #f8f8f9;

  h2 {
    color: #989ca3;
    font-size: 30px;
    font-weight: 400;
    padding-left: 1rem;
  }

  ol {
    text-decoration: none;
    list-style: none;
    padding-left: 0;

    li {
      display: flex;
      color: #767b85;
      margin-bottom: 0.8rem;
      margin-right: 4rem;
      padding: 0.8rem 0;
      align-items: center;
      padding-left: 1rem;
      position: relative;

      &:hover {
        background: #fff;

        &:before {
          content: "";
          background: #44827e;
          width: 4px;
          height: 20px;
          position: absolute;
          border-radius: 1px;
          left: 0;
        }
      }

      a {
        text-decoration: none;
        color: #767b85;
        font-weight: 400;
        font-size: 22px;
        font-family: ${headingFont};
        line-height: 1;
        align-self: center;
      }
    }
  }

  ol:first-of-type {
    margin-bottom: 4rem;
  }
  ol:last-of-type {
    margin-bottom: 3rem;
  }
`

const PlaceholderAvatar = styled.div`
  background: #dddee0;
  border-radius: 100%;
  height: 34px;
  width: 34px;
  margin-right: 15px;
`

const StyledButton = styled.button`
  display: flex;
  border: none;
  justify-content: center;
  padding: 1rem 2rem;
  margin-left: 1rem;
  font-size: 18px;
  color: #313947;
  width: 21rem;
`
const ListItem = styled.li`
  margin-left: 2rem;
`

const SideNavigation = () => {
  const [active, setActive] = useState<string>()

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

      <h2>Current course</h2>
      <ol>
        {currentCourse.map(({ text, items, id, path }, index) => (
          <div
            key={text}
            onClick={() => {
              const activeId = active !== id && items ? id : ""
              setActive(activeId)
            }}
            onKeyDown={() => {
              const activeId = active !== id && items ? id : ""
              setActive(activeId)
            }}
            role="button"
            tabIndex={index}
          >
            <li>
              <PlaceholderAvatar></PlaceholderAvatar>
              <a href={path}>{text}</a>
            </li>
            {active === id &&
              items?.map(({ text, path }) => (
                <ListItem key={text}>
                  <PlaceholderAvatar></PlaceholderAvatar>
                  <a href={path}>{text}</a>
                </ListItem>
              ))}
          </div>
        ))}
      </ol>

      <StyledButton> Join new course</StyledButton>
    </Wrapper>
  )
}

export default SideNavigation

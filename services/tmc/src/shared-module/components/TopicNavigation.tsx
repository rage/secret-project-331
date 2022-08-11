import { css } from "@emotion/css"
import styled from "@emotion/styled"
import { useEffect, useState } from "react"

import useHeadingData from "../hooks/useHeadingData"

const StlyedWrapper = styled.div`
  display: block;
  position: sticky;
  top: 24px;
  max-width: 500px;
  max-height: calc(100vh - 40px);
  overflow: auto;
  padding: 2rem;

  h3 {
    margin-bottom: 1rem;
  }
`
const StyledTopics = styled.div`
  box-sizing: border-box;
  border-left: 3px solid #ebedee;
`
const StTopic = styled.div`
  display: flex;
  text-decoration: none;
  list-style: none;
  color: #333;
  justify-content: space-between;
  position: relative;

  border-left: 3px solid transparent;
  padding: 0.8rem 1rem 0.8rem 1.5rem;
  width: 100%;
  margin: 0;
  font-size: 20px;
  cursor: pointer;

  li {
    max-width: 100%;
    color: #333;

    a {
      text-decoration: none;
      color: #1a2333;
      font-weight: 400;
      display: inline-block;
      text-transform: lowercase;
      &:first-letter {
        text-transform: uppercase;
      }
    }
  }

  &:before {
    content: "";
    position: absolute;
    left: -6px;
    top: 0;
    width: 3px;
    height: 100%;
    background: transparent;
    opacity: 0.8;
  }
`
export interface Topic {
  id: string
  offsetTop: number
  offsetHeight: number
  text: string
}

const PLACEHOLDER_TEXT = "TOPIC"

export type TopicNavigationProps = React.HTMLAttributes<HTMLDivElement>

const TopicNavigation: React.FC<TopicNavigationProps> = () => {
  // eslint-disable-next-line i18next/no-literal-string
  const [isActive, setIsActive] = useState<string>("id-1")

  const { headings } = useHeadingData()

  useEffect(() => {
    const eventHandler = () => {
      const pageYOffset = window.pageYOffset
      if (headings) {
        headings.forEach(({ id, offsetHeight, offsetTop }) => {
          const offsetBottom = offsetHeight + offsetTop + 60
          if (pageYOffset >= offsetTop && pageYOffset <= offsetBottom) {
            setIsActive(id)
          }
        })
      }
    }

    window.addEventListener("scroll", eventHandler)
    return () => {
      window.removeEventListener("scroll", eventHandler)
    }
  }, [headings])

  return (
    <StlyedWrapper>
      <h3>{PLACEHOLDER_TEXT}</h3>
      <StyledTopics role="navigation">
        {headings &&
          headings.map(({ id, title }) => {
            return (
              <StTopic
                key={id}
                className={css`
                  ${isActive === id &&
                  "background: #DAE6E5; /* border-color: #065853 !important; */ &:before{background: #1F6964 !important}"}
                `}
              >
                <li>
                  <a
                    href={`#${id}`}
                    onClick={(e) => {
                      e.preventDefault()
                      document.querySelector(`[id='${id}']`)?.scrollIntoView({
                        behavior: "smooth",
                      })
                    }}
                  >
                    {title}
                  </a>
                </li>
              </StTopic>
            )
          })}
      </StyledTopics>
    </StlyedWrapper>
  )
}

export default TopicNavigation

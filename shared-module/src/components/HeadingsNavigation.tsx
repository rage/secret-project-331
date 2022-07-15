import { css } from "@emotion/css"
import styled from "@emotion/styled"
import { faArrowLeft, faArrowRight } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

import useHeadingData from "../hooks/useHeadingData"

const StyledWrapper = styled.div`
  /* Styling */
  max-width: 500px;
  max-height: calc(100vh - 40px);

  padding: 2rem;
  z-index: 10;
  background-color: #f8f8f8;

  h3 {
    margin-bottom: 1rem;
  }
`
const StyledTopics = styled.div`
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
  padding: 0.4rem 0.5rem 0.4rem 0.75rem;
  width: 100%;
  margin: 0;
  font-size: 20px;
  cursor: pointer;

  div {
    max-width: 100%;
    color: #333;

    a {
      max-width: 30ch;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      text-decoration: none;
      color: #1a2333;
      font-size: 11px;
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

const isRunningOnMobile = () => {
  return window.matchMedia("(max-width: 800px)").matches
}

export interface Topic {
  id: string
  offsetTop: number
  offsetHeight: number
  text: string
}

const Y_OFFSET = 650
const TOP_OFFSET = 50

export type HeadingsNavigationProps = React.HTMLAttributes<HTMLDivElement>

const HeadingsNavigation: React.FC<HeadingsNavigationProps> = () => {
  // eslint-disable-next-line i18next/no-literal-string
  const [isActive, setIsActive] = useState<string>("id-1")
  const [offsetpx, setOffsetpx] = useState<number>(Y_OFFSET + TOP_OFFSET)
  const [fixed, setFixed] = useState<boolean>(isRunningOnMobile())
  const [hidden, setHidden] = useState<boolean>(isRunningOnMobile())
  const [visible, setVisible] = useState<boolean>(false)
  const { headings } = useHeadingData()
  const { t } = useTranslation()

  useEffect(() => {
    const onScroll = () => {
      if (window.pageYOffset > Y_OFFSET) {
        setFixed(true)
        setOffsetpx(TOP_OFFSET)
      } else {
        setFixed(false)
        setOffsetpx(TOP_OFFSET + Y_OFFSET)
      }
    }
    window.addEventListener("scroll", onScroll)
    return () => window.removeEventListener("scroll", onScroll)
  })

  useEffect(() => {
    if (headings.length > 0) {
      setVisible(true)
    }
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
    <>
      <StyledWrapper
        className={css`
          position: ${fixed ? "fixed" : "absolute"};
          left: 0px;
          top: ${offsetpx}px;
          transition: transform 0.3s;
          transform: ${hidden ? "translateX(-282px);" : "translateX(0px)"};
          display: ${!visible ? "none" : "block"};
        `}
      >
        <h3
          className={css`
            font-size: 12px;
            text-transform: uppercase;
            display: inline;
          `}
        >
          {t("in-this-page")}
        </h3>

        <StyledTopics role="navigation">
          <div>
            {headings &&
              headings.map(({ id, title, offsetTop }) => {
                return (
                  <StTopic
                    key={id}
                    className={css`
                      ${isActive === id &&
                      "background: #DAE6E5; /* border-color: #065853 !important; */ &:before{background: #1F6964 !important}"}
                    `}
                  >
                    <div>
                      <a
                        href={`#${id}`}
                        onClick={(e) => {
                          e.preventDefault()
                          window.scrollTo({ top: offsetTop, behavior: "smooth" })
                        }}
                      >
                        {title}
                      </a>
                    </div>
                  </StTopic>
                )
              })}
          </div>
        </StyledTopics>
      </StyledWrapper>
      <button
        onClick={() => setHidden(!hidden)}
        aria-label={hidden ? t("open-heading-menu") : t("close-heading-menu")}
        className={css`
          all: unset;
          display: ${!visible ? "none" : "inline"};
          position: ${fixed ? "fixed" : "absolute"};
          left: 0px;
          top: ${offsetpx}px;
          cursor: pointer;
          background-color: #f8f8f8;
          width: 40px;
          height: 40px;
          z-index: 10;
        `}
      >
        <FontAwesomeIcon
          className={css`
            top: 36%;
            left: 36%;
            position: absolute;
          `}
          icon={hidden ? faArrowRight : faArrowLeft}
        />
      </button>
    </>
  )
}

export default HeadingsNavigation

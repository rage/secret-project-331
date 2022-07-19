import { css } from "@emotion/css"
import styled from "@emotion/styled"
import { faArrowLeft, faArrowRight } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { maxBy, minBy } from "lodash"
import { useCallback, useContext, useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { useMediaQuery } from "usehooks-ts"

import PageContext from "../contexts/PageContext"
import useHeadingData from "../hooks/useHeadingData"
import useIsPageChapterFrontPage from "../hooks/useIsPageChapterFrontPage"
import { baseTheme } from "../shared-module/styles/theme"
import { isElementFullyInViewport } from "../shared-module/utils/dom"

const StyledTopics = styled.div`
  border-left: 3px solid #ebedee;
  margin-top: 1rem;
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

export interface Topic {
  id: string
  offsetTop: number
  offsetHeight: number
  text: string
}

const Y_OFFSET = 650
const TOP_OFFSET = 50

const HEADING_START_OFFSET_PX = -30
const HEADING_SCROLL_DESTINATION_START_OFFSET_PX = -15

export type HeadingsNavigationProps = React.HTMLAttributes<HTMLDivElement>

const HeadingsNavigation: React.FC<HeadingsNavigationProps> = () => {
  // eslint-disable-next-line i18next/no-literal-string
  const [activeHeading, setActiveHeading] = useState<string | undefined>(undefined)
  // Ref to optimize useEffect. A number to keep multiple clicks from interfering with each other
  const numberOfCallbacksScrollingTheDocument = useRef(0)

  const [offsetpx, setOffsetpx] = useState<number>(Y_OFFSET + TOP_OFFSET)
  const runningOnOnMobile = useMediaQuery("(max-width: 1300px)")
  const [fixedBasedOnScrolPosition, setFixedBasedOnScrollPosition] =
    useState<boolean>(runningOnOnMobile)
  const [userHasCollapsed, setUserHasCollapsed] = useState<boolean | null>(null)
  const { headings } = useHeadingData()
  const { t } = useTranslation()
  const pageContext = useContext(PageContext)
  const isPageChapterFrontPageQuery = useIsPageChapterFrontPage(pageContext.pageData?.id)

  const canUseFixedBasedOnScreenWidth = useMediaQuery("(min-width: 870px)")
  const fixed = canUseFixedBasedOnScreenWidth ? fixedBasedOnScrolPosition : true

  useEffect(() => {
    const onScroll = () => {
      if (window.pageYOffset > Y_OFFSET) {
        setFixedBasedOnScrollPosition(true)
        setOffsetpx(TOP_OFFSET)
      } else {
        setFixedBasedOnScrollPosition(false)
        setOffsetpx(TOP_OFFSET + Y_OFFSET)
      }
    }
    window.addEventListener("scroll", onScroll)
    return () => window.removeEventListener("scroll", onScroll)
  })

  const onScrollCallback = useCallback(() => {
    if (numberOfCallbacksScrollingTheDocument.current > 0) {
      // The page is scolling right now, skip the update to prevent messing up the indicator
      return
    }
    const pageYOffset = window.pageYOffset
    if (headings) {
      const headingOffsets = headings.map((heading) => {
        return {
          offsetTop: heading.element.offsetTop + HEADING_START_OFFSET_PX,
          heading: heading,
        }
      })
      // Find the first heading that is above the current page's pageYOffset
      const firstAbove = maxBy(
        headingOffsets.filter((offsetEntry) => offsetEntry.offsetTop < pageYOffset),
        (offsetEntry) => offsetEntry.offsetTop,
      )
      console.log({ firstAbove })
      if (firstAbove) {
        setActiveHeading(firstAbove.heading.headingsNavigationIndex)
        return
      }
      // No heading is above the current page's pageYOffset, find the first heading that is below the current page's pageYOffset
      const firstBelow = minBy(headingOffsets, (offsetEntry) => offsetEntry.offsetTop)
      // Only set the below element active if it's fully visible on the screen
      if (firstBelow && isElementFullyInViewport(firstBelow.heading.element)) {
        setActiveHeading(firstBelow.heading.headingsNavigationIndex)
      }
    }
  }, [headings])

  useEffect(() => {
    window.addEventListener("scroll", onScrollCallback)
    try {
      // Call the event handler once to set the active heading on page load
      onScrollCallback()
    } catch (e) {
      console.error(e)
    }
    return () => {
      window.removeEventListener("scroll", onScrollCallback)
    }
  }, [onScrollCallback])

  let realCollapsed = userHasCollapsed
  if (realCollapsed === null) {
    realCollapsed = runningOnOnMobile
    if (
      pageContext.exam !== null ||
      // Collapsed by default on chapter front pages
      isPageChapterFrontPageQuery.isLoading ||
      isPageChapterFrontPageQuery.data?.is_chapter_front_page === true
    ) {
      realCollapsed = true
    }
  }

  // More that 1 heading is required to show the headings navigation. We don't show this for pages with only one heading because all pages are supposed to have a hero section that contain one h1 heading that is included in the headings list. Showing only this heading would look weird.
  // Also, disable the headings navigation on exam pages because we don't want to distract students.
  if (headings.length <= 1 || pageContext.exam !== null) {
    return null
  }

  return (
    <>
      <div
        className={css`
          max-width: 500px;
          max-height: calc(100vh - 40px);

          padding: 1.5rem;
          padding-top: 9px;
          z-index: 10;
          background-color: #f8f8f8;

          h3 {
            margin-bottom: 1rem;
          }

          position: ${fixed ? "fixed" : "absolute"};
          left: 0px;
          top: ${offsetpx}px;
          transition: transform 0.3s;
          transform: ${realCollapsed ? "translateX(-282px);" : "translateX(0px)"};
        `}
      >
        <h3
          className={css`
            font-size: 12px;
            text-transform: uppercase;
            display: inline;
            position: relative;
            left: 18px;
          `}
        >
          {t("in-this-page")}
        </h3>

        <StyledTopics role="navigation">
          <div>
            {headings &&
              headings.map(({ headingsNavigationIndex, title, element }) => {
                return (
                  <a
                    className={css`
                      text-decoration: none;
                    `}
                    key={headingsNavigationIndex}
                    href={`#${headingsNavigationIndex}`}
                    onClick={(e) => {
                      e.preventDefault()
                      try {
                        // Atomic, since Javascript is single-threaded
                        numberOfCallbacksScrollingTheDocument.current += 1
                        setActiveHeading(headingsNavigationIndex)

                        window.scrollTo({
                          // we have to calculate the position of the element because it might have moved
                          top: element.offsetTop + HEADING_SCROLL_DESTINATION_START_OFFSET_PX,
                          behavior: "smooth",
                        })
                      } finally {
                        // We don't know when the scroll animation is done, so we'll guess
                        // The timeout has to be unfortunately long because the scroll animation may take quite some time
                        setTimeout(() => {
                          // Atomic, since Javascript is single-threaded
                          numberOfCallbacksScrollingTheDocument.current -= 1
                          // Since we have skipped updating the active heading indicator for some time, it's a good idea to update it now
                          onScrollCallback()
                        }, 3000)
                      }
                    }}
                  >
                    <StTopic
                      className={css`
                        ${activeHeading === headingsNavigationIndex &&
                        `background: #DAE6E5;
                        &:before{
                          background: #1F6964 !important
                        }`}
                      `}
                    >
                      <div>{title}</div>
                    </StTopic>
                  </a>
                )
              })}
          </div>
        </StyledTopics>
      </div>
      <button
        onClick={() => setUserHasCollapsed(!realCollapsed)}
        aria-label={realCollapsed ? t("open-heading-menu") : t("close-heading-menu")}
        className={css`
          all: unset;
          position: ${fixed ? "fixed" : "absolute"};
          left: 0px;
          top: ${offsetpx}px;
          cursor: pointer;
          transition: background-color 0.2s;
          background-color: ${realCollapsed ? "#f8f8f8" : "transparent"};
          width: 40px;
          height: 40px;
          z-index: 10;
          display: flex;
          align-items: center;
          justify-content: center;

          &:focus-visible {
            outline: 2px solid ${baseTheme.colors.green[500]};
            outline-offset: 2px;
          }
        `}
      >
        <FontAwesomeIcon icon={realCollapsed ? faArrowRight : faArrowLeft} />
      </button>
    </>
  )
}

export default HeadingsNavigation

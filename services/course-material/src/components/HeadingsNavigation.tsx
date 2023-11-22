import { css } from "@emotion/css"
import styled from "@emotion/styled"
import { ArrowLeft, ArrowRight } from "@vectopus/atlas-icons-react"
import { maxBy, minBy } from "lodash"
import { useCallback, useContext, useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { useMediaQuery } from "usehooks-ts"

import PageContext from "../contexts/PageContext"
import useHeadingData from "../hooks/useHeadingData"
import useIsPageChapterFrontPage from "../hooks/useIsPageChapterFrontPage"
import useShouldHideStuffFromSystemTestScreenshots from "../shared-module/hooks/useShouldHideStuffForSystemTestScreenshots"
import { baseTheme } from "../shared-module/styles/theme"
import { isElementFullyInViewport } from "../shared-module/utils/dom"
import { courseMaterialBlockClass } from "../utils/constants"

const HERO_SECTION_Y_OFFSET_PX = 700
const TOP_OFFSET_PX = 50
const MOBILE_TOP_OFFSET_PX = 100

const HEADING_START_OFFSET_PX = -30
const HEADING_SCROLL_DESTINATION_START_OFFSET_PX = -20

const WIDTH_PX = 300

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
  font-size: 15px;
  line-height: 1.4;
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

export type HeadingsNavigationProps = React.HTMLAttributes<HTMLDivElement>

const HeadingsNavigation: React.FC<React.PropsWithChildren<HeadingsNavigationProps>> = () => {
  const shouldHideStuffFromSystemTestScreenshots = useShouldHideStuffFromSystemTestScreenshots()
  const [activeHeading, setActiveHeading] = useState<string | undefined>(undefined)
  // Ref to optimize useEffect. A number to keep multiple clicks from interfering with each other
  const numberOfCallbacksScrollingTheDocument = useRef(0)

  const expandedNavigationWillOverlapWithContent = useMediaQuery("(max-width: 1400px)")
  const screenWidthSoWideThatWeCanUseAbsolutePositioningInitially =
    useMediaQuery("(min-width: 870px)")
  const [offsetpx, setOffsetpx] = useState<number>(
    screenWidthSoWideThatWeCanUseAbsolutePositioningInitially
      ? HERO_SECTION_Y_OFFSET_PX + HERO_SECTION_Y_OFFSET_PX
      : MOBILE_TOP_OFFSET_PX,
  )

  const [fixedBasedOnScrolPosition, setFixedBasedOnScrollPosition] = useState<boolean>(
    expandedNavigationWillOverlapWithContent,
  )
  const [userHasCollapsed, setUserHasCollapsed] = useState<boolean | null>(null)
  const { headings } = useHeadingData()
  const { t } = useTranslation()
  const pageContext = useContext(PageContext)
  const isPageChapterFrontPageQuery = useIsPageChapterFrontPage(pageContext.pageData?.id)

  // When the we have not scrolled past the hero section and are on a large enough screen, we we will use absolute positioning to position the navigation to be just under the hero section. On narrower screens, and when we have scrolled further down the page, we will use fixed positioning to keep the navigation at a constant position.
  const fixed = screenWidthSoWideThatWeCanUseAbsolutePositioningInitially
    ? fixedBasedOnScrolPosition
    : true

  const onScrollCallback1 = useCallback(() => {
    if (!screenWidthSoWideThatWeCanUseAbsolutePositioningInitially) {
      setFixedBasedOnScrollPosition(true)
      setOffsetpx(MOBILE_TOP_OFFSET_PX)
    } else if (window.scrollY > HERO_SECTION_Y_OFFSET_PX) {
      setFixedBasedOnScrollPosition(true)
      setOffsetpx(TOP_OFFSET_PX)
    } else {
      setFixedBasedOnScrollPosition(false)
      setOffsetpx(TOP_OFFSET_PX + HERO_SECTION_Y_OFFSET_PX)
    }
  }, [screenWidthSoWideThatWeCanUseAbsolutePositioningInitially])

  useEffect(() => {
    window.addEventListener("scroll", onScrollCallback1)
    try {
      // Call the event handler once to set the active heading on page load
      onScrollCallback1()
    } catch (e) {
      console.error(e)
    }
    return () => {
      window.removeEventListener("scroll", onScrollCallback1)
    }
  }, [onScrollCallback1])

  const onScrollCallback2 = useCallback(() => {
    if (numberOfCallbacksScrollingTheDocument.current > 0) {
      // The page is scolling right now, skip the update to prevent messing up the indicator
      return
    }
    const pageYOffset = window.scrollY
    if (headings) {
      const headingOffsets = headings.map((heading) => {
        // Better to use to use the parent provided by the block -- it makes scrolling to hero section to reveal the whole block
        const blockElement =
          heading.element.closest(`.${courseMaterialBlockClass}`) || heading.element
        const elementYCoordinateRelativeToViewport = blockElement.getBoundingClientRect().top
        const yCoordinate = elementYCoordinateRelativeToViewport + window.scrollY
        return {
          yCoordinate: yCoordinate + HEADING_START_OFFSET_PX,
          heading: heading,
        }
      })
      // Find the first heading that is above the current page's pageYOffset
      const firstAbove = maxBy(
        headingOffsets.filter((offsetEntry) => offsetEntry.yCoordinate < pageYOffset),
        (offsetEntry) => offsetEntry.yCoordinate,
      )
      if (firstAbove) {
        setActiveHeading(firstAbove.heading.headingsNavigationIndex)
        return
      }
      // No heading is above the current page's pageYOffset, find the first heading that is below the current page's pageYOffset
      const firstBelow = minBy(headingOffsets, (offsetEntry) => offsetEntry.yCoordinate)
      // Only set the below element active if it's fully visible on the screen
      if (firstBelow && isElementFullyInViewport(firstBelow.heading.element)) {
        setActiveHeading(firstBelow.heading.headingsNavigationIndex)
      }
    }
  }, [headings])

  useEffect(() => {
    window.addEventListener("scroll", onScrollCallback2)
    try {
      // Call the event handler once to set the active heading on page load
      onScrollCallback2()
    } catch (e) {
      console.error(e)
    }
    return () => {
      window.removeEventListener("scroll", onScrollCallback2)
    }
  }, [onScrollCallback2])

  let realCollapsed = userHasCollapsed
  if (realCollapsed === null) {
    realCollapsed = expandedNavigationWillOverlapWithContent
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
  if (
    headings.length <= 1 ||
    pageContext.exam !== null ||
    shouldHideStuffFromSystemTestScreenshots
  ) {
    return null
  }

  return (
    <>
      <div
        className={css`
          width: ${WIDTH_PX}px;
          max-height: 90vh;
          overflow-y: auto;

          padding: 1.5rem;
          padding-top: 12px;
          z-index: 1000;
          background-color: rgb(246, 248, 250);

          h3 {
            margin-bottom: 1rem;
          }

          position: ${fixed ? "fixed" : "absolute"};
          /** Aligned to the right because our content text is left aligned and if this is on the right it's less likely that this will overlap with the content. **/
          right: 0px;
          top: ${offsetpx}px;
          transition: transform 0.3s;
          transform: ${realCollapsed ? `translateX(${WIDTH_PX}px);` : "translateX(0px)"};
        `}
        aria-hidden={Boolean(realCollapsed)}
      >
        {!realCollapsed && (
          <div>
            <h3
              className={css`
                font-size: 16px;
                color: ${baseTheme.colors.gray[600]};
                font-weight: 700;
                display: inline;
                position: relative;
                left: -2px;
                bottom: -3px;
              `}
            >
              {t("in-this-page")}
            </h3>
            <StyledTopics role="navigation">
              <div>
                {headings &&
                  headings.map(({ headingsNavigationIndex, title, element }) => {
                    return (
                      <button
                        className={css`
                          border: none;
                          background: unset;
                          text-align: left;
                          width: 100%;
                          padding: 0;
                        `}
                        tabIndex={realCollapsed ? -1 : 0}
                        key={headingsNavigationIndex}
                        onClick={(e) => {
                          e.preventDefault()
                          try {
                            // Atomic, since Javascript is single-threaded
                            numberOfCallbacksScrollingTheDocument.current += 1
                            setActiveHeading(headingsNavigationIndex)

                            // Better to use to use the parent provided by the block -- it makes scrolling to hero section to reveal the whole block
                            const blockElement =
                              element.closest(`.${courseMaterialBlockClass}`) || element

                            // we have to calculate the position of the element because it might have moved.
                            const elementYCoordinateRelativeToViewport =
                              blockElement.getBoundingClientRect().top
                            const top = elementYCoordinateRelativeToViewport + window.scrollY
                            window.scrollTo({
                              top: top + HEADING_SCROLL_DESTINATION_START_OFFSET_PX,
                              behavior: "smooth",
                            })
                          } finally {
                            // We don't know when the scroll animation is done, so we'll guess
                            // The timeout has to be unfortunately long because the scroll animation may take quite some time
                            setTimeout(() => {
                              // Atomic, since Javascript is single-threaded
                              numberOfCallbacksScrollingTheDocument.current -= 1
                              // Since we have skipped updating the active heading indicator for some time, it's a good idea to update it now
                              onScrollCallback2()
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
                      </button>
                    )
                  })}
              </div>
            </StyledTopics>
          </div>
        )}
      </div>

      <button
        onClick={() => setUserHasCollapsed(!realCollapsed)}
        aria-label={realCollapsed ? t("open-heading-menu") : t("close-heading-menu")}
        className={css`
          all: unset;
          position: ${fixed ? "fixed" : "absolute"};
          right: 0px;
          top: ${offsetpx}px;
          cursor: pointer;
          transition: background-color 0.2s;
          background-color: ${realCollapsed ? "#f8f8f8" : "transparent"};
          width: 40px;
          height: 40px;
          z-index: 1005;
          display: flex;
          align-items: center;
          justify-content: center;

          &:focus-visible {
            outline: 2px solid ${baseTheme.colors.green[500]};
            outline-offset: 2px;
          }
        `}
      >
        {realCollapsed ? (
          <ArrowLeft size={16} weight="bold" />
        ) : (
          <ArrowRight size={16} weight="bold" />
        )}
      </button>
    </>
  )
}

export default HeadingsNavigation

import { css } from "@emotion/css"
import React, { useContext, useEffect, useState } from "react"

import CoursePageContext, { CoursePageDispatch } from "../contexts/CoursePageContext"
import { Block } from "../services/backend"
import DebugModal from "../shared-module/components/DebugModal"
import { normalWidthCenteredComponentStyles } from "../shared-module/styles/componentStyles"

import ContentRenderer from "./ContentRenderer"
import FeedbackButton from "./FeedbackButton"
import FeedbackTooltip from "./FeedbackTooltip"
import NavigationContainer from "./NavigationContainer"
import SelectCourseInstanceModal from "./modals/SelectCourseInstanceModal"

interface Props {
  courseSlug: string
  onRefresh: () => void
}

const Page: React.FC<Props> = ({ courseSlug, onRefresh }) => {
  const pageContext = useContext(CoursePageContext)
  const pageDispatch = useContext(CoursePageDispatch)
  const [x, setX] = useState(0)
  const [y, setY] = useState(0)
  const [selection, setSelection] = useState("")

  function selectionHandler(this: Document) {
    const docSelection = this.getSelection()
    if (docSelection == null || !docSelection.rangeCount) {
      return
    }
    const range = docSelection.getRangeAt(0)
    if (range == null) {
      setSelection("")
      return
    }

    const contents = range.cloneContents()
    if (contents.textContent == null) {
      setSelection("")
      return
    }

    const rects = range.getClientRects()
    if (rects.length < 1) {
      setSelection("")
      return
    }
    const rect = rects[0]
    console.log(rect)
    setX(rect.x)
    setY(rect.y - 40)
    setSelection(contents.textContent)
  }

  useEffect(() => {
    document.addEventListener("selectionchange", selectionHandler)

    return function cleanup() {
      document.removeEventListener("selectionchange", selectionHandler)
    }
  })

  return (
    <>
      <div
        className={css`
          position: absolute;
          top: 10px;
          right: 10px;
        `}
      >
        <DebugModal
          data={pageContext}
          updateDataOnClose={(payload) => {
            // NB! This is unsafe because payload has any type
            pageDispatch({ type: "rawSetState", payload })
          }}
          readOnly={false}
        />
      </div>
      <div
        className={css`
          position: fixed;
          bottom: 10px;
          right: 10px;
          overflow: hidden;
        `}
      >
        <FeedbackButton courseSlug={courseSlug} />
      </div>
      <div
        hidden={selection.length === 0}
        className={css`
          position: relative;
          top: ${y}px;
          left: ${x}px;
        `}
      >
        <FeedbackTooltip selection={selection} />
      </div>
      <h1
        className={css`
          ${normalWidthCenteredComponentStyles}
        `}
      >
        {pageContext.pageData?.title}
      </h1>
      <SelectCourseInstanceModal onClose={onRefresh} />
      {/* TODO: Better type for Page.content in bindings. */}
      <div id="content">
        <ContentRenderer data={(pageContext.pageData?.content as Array<Block<unknown>>) ?? []} />
      </div>
      {pageContext.pageData?.chapter_id && <NavigationContainer />}
    </>
  )
}

export default Page

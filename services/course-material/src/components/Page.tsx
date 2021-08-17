import { css } from "@emotion/css"
import React, { useContext, useState } from "react"

import CoursePageContext, { CoursePageDispatch } from "../contexts/CoursePageContext"
import { Block } from "../services/backend"
import Button from "../shared-module/components/Button"
import DebugModal from "../shared-module/components/DebugModal"
import { normalWidthCenteredComponentStyles } from "../shared-module/styles/componentStyles"

import ContentRenderer from "./ContentRenderer"
import NavigationContainer from "./ContentRenderer/NavigationContainer"
import FeedbackDialog from "./FeedbackDialog"
import FeedbackTooltip from "./FeedbackTooltip"
import SelectionListener from "./SelectionListener"
import SelectCourseInstanceModal from "./modals/SelectCourseInstanceModal"

interface Props {
  courseSlug: string
  onRefresh: () => void
}

const Page: React.FC<Props> = ({ courseSlug, onRefresh }) => {
  const pageContext = useContext(CoursePageContext)
  const pageDispatch = useContext(CoursePageDispatch)
  const [feedbackDialogOpen, setFeedbackDialogOpen] = useState(false)
  const [selection, setSelection] = useState("")
  const [feedbackSelection, setFeedbackSelection] = useState("")
  const [showFeedbackTooltip, setShowFeedbackTooltip] = useState(false)
  const [showFeedbackTooltipTimeout, setShowFeedbackTooltipTimeout] =
    useState<NodeJS.Timeout | null>(null)
  const [selectionRect, setSelectionRect] = useState<DOMRect | null>(null)

  async function handleSelectionChange(selection: string, rect: DOMRect | null) {
    if (showFeedbackTooltipTimeout !== null) {
      clearTimeout(showFeedbackTooltipTimeout)
    }
    setShowFeedbackTooltip(false)
    setSelection(selection)

    const timeout = setTimeout(() => {
      if (selection.length > 0) {
        setShowFeedbackTooltip(true)
        setSelectionRect(rect)
      } else {
        setShowFeedbackTooltip(false)
        setSelectionRect(null)
      }
    }, 200)
    setShowFeedbackTooltipTimeout(timeout)
  }

  return (
    <>
      <div
        className={css`
          text-align: right;
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
        <Button
          variant={"primary"}
          size={"medium"}
          onClick={() => {
            setFeedbackSelection(selection)
            setFeedbackDialogOpen(true)
          }}
        >
          Give feedback
        </Button>
      </div>
      <FeedbackTooltip
        show={showFeedbackTooltip}
        selectionRect={selectionRect}
        onClick={() => {
          setFeedbackSelection(selection)
          setFeedbackDialogOpen(true)
        }}
      />
      <FeedbackDialog
        courseSlug={courseSlug}
        open={feedbackDialogOpen}
        close={() => setFeedbackDialogOpen(false)}
        selection={feedbackSelection}
      />
      <SelectionListener onSelectionChange={handleSelectionChange} />
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

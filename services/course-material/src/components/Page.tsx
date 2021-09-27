import { css } from "@emotion/css"
import React, { useContext, useEffect, useState } from "react"

import CoursePageContext, { CoursePageDispatch } from "../contexts/CoursePageContext"
import { Block } from "../services/backend"
import { NewProposedBlockEdit } from "../shared-module/bindings"
import DebugModal from "../shared-module/components/DebugModal"
import { courseMaterialBlockClass } from "../utils/constants"

import ContentRenderer from "./ContentRenderer"
import NavigationContainer from "./ContentRenderer/NavigationContainer"
import FeedbackHandler from "./FeedbackHandler"
import SelectCourseInstanceModal from "./modals/SelectCourseInstanceModal"
import UserOnWrongCourseNotification from "./notifications/UserOnWrongCourseNotification"

interface Props {
  onRefresh: () => void
}

const Page: React.FC<Props> = ({ onRefresh }) => {
  // block id -> new block contents
  const [edits, setEdits] = useState<Map<string, NewProposedBlockEdit>>(new Map())
  const pageContext = useContext(CoursePageContext)
  const pageDispatch = useContext(CoursePageDispatch)
  const [editingMaterial, setEditingMaterial] = useState(false)

  const courseId = pageContext?.pageData?.course_id
  const pageId = pageContext?.pageData?.id

  const [selectedBlockId, setSelectedBlockId] = useState(document.activeElement?.id ?? null)
  useEffect(() => {
    const handler = (ev: MouseEvent) => {
      if (ev.target instanceof Element) {
        // go through the clicked element's parents until we find a block
        let blockId = null
        let element: Element | null = ev.target
        while (element !== null) {
          if (element.classList.contains(courseMaterialBlockClass)) {
            blockId = element.id
            break
          }
          element = element.parentElement
        }
        setSelectedBlockId(blockId)
      } else {
        setSelectedBlockId(null)
      }
    }
    document.addEventListener("click", handler)
    return () => {
      document.removeEventListener("click", handler)
    }
  }, [])

  return (
    <>
      {pageContext.settings &&
        pageContext.settings.current_course_instance_id !== pageContext.instance?.id && (
          <UserOnWrongCourseNotification
            correctCourseId={pageContext.settings?.current_course_id}
          />
        )}
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
      <SelectCourseInstanceModal onClose={onRefresh} />
      {courseId && pageId && (
        <FeedbackHandler
          courseId={courseId}
          pageId={pageId}
          onEnterEditProposalMode={() => {
            setEditingMaterial(true)
          }}
          onExitEditProposalMode={() => {
            setEditingMaterial(false)
            setEdits(new Map())
          }}
          selectedBlockId={selectedBlockId}
          setSelectedBlockId={setSelectedBlockId}
          edits={edits}
        />
      )}
      {/* TODO: Better type for Page.content in bindings. */}
      <div id="content">
        <ContentRenderer
          data={(pageContext.pageData?.content as Array<Block<unknown>>) ?? []}
          editing={editingMaterial}
          selectedBlockId={selectedBlockId}
          setEdits={setEdits}
        />
      </div>
      {pageContext.pageData?.chapter_id && <NavigationContainer />}
    </>
  )
}

export default Page

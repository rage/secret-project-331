import React, { useContext, useState } from "react"

import PageContext from "../contexts/PageContext"
import useSelectedBlockId from "../hooks/useSelectedBlockId"
import { Block } from "../services/backend"
import { NewProposedBlockEdit } from "../shared-module/bindings"
import withErrorBoundary from "../shared-module/utils/withErrorBoundary"
import { inlineColorStyles } from "../styles/inlineColorStyles"

import ContentRenderer from "./ContentRenderer"
import NavigationContainer from "./ContentRenderer/moocfi/NavigationContainer"
import FeedbackHandler from "./FeedbackHandler"
import HeadingsNavigation from "./HeadingsNavigation"
import ReferenceList from "./ReferencesList"
import SelectCourseInstanceModal from "./modals/SelectCourseInstanceModal"
import UserOnWrongCourseNotification from "./notifications/UserOnWrongCourseNotification"

interface Props {
  onRefresh: () => void
  organizationSlug: string
}

const Page: React.FC<Props> = ({ onRefresh, organizationSlug }) => {
  // block id -> new block contents
  const [edits, setEdits] = useState<Map<string, NewProposedBlockEdit>>(new Map())
  const pageContext = useContext(PageContext)
  const [editingMaterial, setEditingMaterial] = useState(false)

  const courseId = pageContext?.pageData?.course_id
  const pageId = pageContext?.pageData?.id

  const [selectedBlockId, clearSelectedBlockId] = useSelectedBlockId()

  return (
    <>
      {pageContext.settings &&
        pageContext.settings.current_course_instance_id !== pageContext.instance?.id && (
          <UserOnWrongCourseNotification
            correctCourseId={pageContext.settings?.current_course_id}
            organizationSlug={organizationSlug}
          />
        )}
      {courseId && <SelectCourseInstanceModal onClose={onRefresh} />}
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
          clearSelectedBlockId={clearSelectedBlockId}
          edits={edits}
        />
      )}
      {pageContext.pageData?.content && Boolean(pageContext.pageData?.chapter_id) && (
        <HeadingsNavigation />
      )}
      {/* TODO: Better type for Page.content in bindings. */}
      <div id="content" className={inlineColorStyles}>
        <ContentRenderer
          data={(pageContext.pageData?.content as Array<Block<unknown>>) ?? []}
          editing={editingMaterial}
          selectedBlockId={selectedBlockId}
          setEdits={setEdits}
          isExam={pageContext.exam !== null}
        />
      </div>
      {pageContext.pageData?.chapter_id && <NavigationContainer />}
      {pageContext.pageData?.course_id && (
        <ReferenceList courseId={pageContext.pageData.course_id} />
      )}
    </>
  )
}

export default withErrorBoundary(Page)

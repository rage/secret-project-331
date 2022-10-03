import { useQuery } from "@tanstack/react-query"
import React, { useContext, useState } from "react"

import { GlossaryContext, GlossaryState } from "../contexts/GlossaryContext"
import PageContext from "../contexts/PageContext"
import useSelectedBlockId from "../hooks/useSelectedBlockId"
import { Block, fetchGlossary } from "../services/backend"
import { NewProposedBlockEdit } from "../shared-module/bindings"
import ErrorBanner from "../shared-module/components/ErrorBanner"
import Spinner from "../shared-module/components/Spinner"
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

const Page: React.FC<React.PropsWithChildren<Props>> = ({ onRefresh, organizationSlug }) => {
  // block id -> new block contents
  const [edits, setEdits] = useState<Map<string, NewProposedBlockEdit>>(new Map())
  const pageContext = useContext(PageContext)
  const [editingMaterial, setEditingMaterial] = useState(false)

  const courseId = pageContext?.pageData?.course_id
  const pageId = pageContext?.pageData?.id
  const isMaterialPage = pageContext.pageData?.content && Boolean(pageContext.pageData?.chapter_id)
  const [selectedBlockId, clearSelectedBlockId] = useSelectedBlockId()

  // Fetch glossary for each page seperately
  const glossary = useQuery([`glossary-${courseId}`], () =>
    courseId && pageContext.exam === null && isMaterialPage ? fetchGlossary(courseId) : [],
  )

  if (glossary.isLoading) {
    return <Spinner variant={"small"} />
  }

  if (glossary.isError) {
    return <ErrorBanner variant={"readOnly"} error={glossary.error} />
  }
  const glossaryState: GlossaryState = { terms: glossary.data }

  return (
    <GlossaryContext.Provider value={glossaryState}>
      <>
        {pageContext.settings &&
          pageContext.settings.current_course_instance_id !== pageContext.instance?.id && (
            <UserOnWrongCourseNotification
              correctCourseId={pageContext.settings?.current_course_id}
              organizationSlug={organizationSlug}
            />
          )}
        {courseId && <SelectCourseInstanceModal onClose={onRefresh} />}

        {isMaterialPage && <HeadingsNavigation />}
        <main id="maincontent">
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
        </main>
        {pageContext.pageData?.chapter_id && <NavigationContainer />}
        {pageContext.pageData?.course_id && (
          <ReferenceList courseId={pageContext.pageData.course_id} />
        )}
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
      </>
    </GlossaryContext.Provider>
  )
}

export default withErrorBoundary(Page)

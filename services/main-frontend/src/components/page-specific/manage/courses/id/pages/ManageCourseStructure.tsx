import { css } from "@emotion/css"
import { faExclamationCircle } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { Dialog } from "@mui/material"
import { QueryObserverResult, RefetchOptions, RefetchQueryFilters } from "@tanstack/react-query"
import { max } from "lodash"
import React, { useEffect, useReducer, useState } from "react"
import { useTranslation } from "react-i18next"

import managePageOrderReducer, {
  managePageOrderInitialState,
} from "../../../../../../reducers/managePageOrderReducer"
import { deleteChapter } from "../../../../../../services/backend/chapters"
import { postNewPageOrdering } from "../../../../../../services/backend/courses"
import { Chapter, CourseStructure } from "../../../../../../shared-module/bindings"
import Button from "../../../../../../shared-module/components/Button"
import BreakFromCentered from "../../../../../../shared-module/components/Centering/BreakFromCentered"
import Centered from "../../../../../../shared-module/components/Centering/Centered"
import DebugModal from "../../../../../../shared-module/components/DebugModal"
import DropdownMenu from "../../../../../../shared-module/components/DropdownMenu"
import useToastMutation from "../../../../../../shared-module/hooks/useToastMutation"
import { baseTheme, typography } from "../../../../../../shared-module/styles"

import ChapterImageWidget from "./ChapterImageWidget"
import NewChapterForm from "./NewChapterForm"
import FrontPage from "./PageList/FrontPage"
import PageList from "./PageList/PageList"

export interface ManageCourseStructureProps {
  courseStructure: CourseStructure
  refetch: (
    options?: (RefetchOptions & RefetchQueryFilters<unknown>) | undefined,
  ) => Promise<QueryObserverResult<CourseStructure, unknown>>
}

const ManageCourseStructure: React.FC<ManageCourseStructureProps> = ({
  courseStructure,
  refetch,
}) => {
  const deleteChapterMutation = useToastMutation(
    (chapterId: string) => {
      return deleteChapter(chapterId)
    },
    { notify: true, method: "DELETE" },
    { onSuccess: () => refetch() },
  )
  const { t } = useTranslation()
  const [showEditChapterForm, setShowEditChapterForm] = useState<boolean>(false)
  const [showEditImageModal, setShowEditImageModal] = useState<boolean>(false)
  const [chapterBeingEdited, setChapterBeingEdited] = useState<Chapter | null>(null)
  const [pageOrderState, pageOrderDispatch] = useReducer(
    managePageOrderReducer,
    managePageOrderInitialState,
  )

  const postNewPageOrderingMutation = useToastMutation(
    () => {
      if (!pageOrderState.chapterIdToPages) {
        // eslint-disable-next-line i18next/no-literal-string
        throw new Error("Page data not loaded")
      }
      const pages = Object.values(pageOrderState.chapterIdToPages).flat()
      return postNewPageOrdering(courseStructure.course.id, pages)
    },
    {
      notify: true,
      method: "POST",
    },
    { onSuccess: () => refetch() },
  )

  useEffect(() => {
    // eslint-disable-next-line i18next/no-literal-string
    pageOrderDispatch({ type: "setData", payload: courseStructure })
  }, [courseStructure])

  const handleCreateChapter = async () => {
    setShowEditChapterForm(!showEditChapterForm)
    setChapterBeingEdited(null)
    await refetch()
  }

  const maxPart = max(courseStructure.chapters.map((p) => p.chapter_number))
  return (
    <>
      <h1>{t("course-pages-for", { "course-name": courseStructure.course.name })}</h1>
      <h2>{t("pages")}</h2>
      <FrontPage
        refetch={refetch}
        data={pageOrderState.chapterIdToFrontPage?.["null"]}
        pageOrderDispatch={pageOrderDispatch}
        chapter={undefined}
      />
      <PageList
        data={pageOrderState.chapterIdToPages?.["null"] ?? []}
        pageOrderDispatch={pageOrderDispatch}
        refetch={refetch}
        courseId={courseStructure.course.id}
        chapter={undefined}
      />
      <div>
        {courseStructure.chapters
          .filter((chapter) => !chapter.deleted_at)
          .sort((a, b) => a.chapter_number - b.chapter_number)
          .map((chapter, n) => (
            <BreakFromCentered key={chapter.id} sidebar={false}>
              <div
                className={css`
                  padding: 6rem 0;
                  background-color: ${n % 2 === 0 ? baseTheme.colors.clear[100] : "white"};
                `}
              >
                <Centered variant="default">
                  <div
                    className={css`
                      float: right;
                      position: relative;
                      top: -20px;
                    `}
                  >
                    <DropdownMenu
                      items={[
                        {
                          label: t("edit"),
                          onClick: () => {
                            setChapterBeingEdited(chapter)
                            setShowEditChapterForm(true)
                          },
                        },
                        {
                          label: t("button-text-edit-image"),
                          onClick: () => {
                            setChapterBeingEdited(chapter)
                            setShowEditImageModal(true)
                          },
                        },
                        {
                          label: t("button-text-delete"),
                          onClick: async () => {
                            if (
                              !confirm(t("message-are-you-sure-you-want-to-delete-this-chapter"))
                            ) {
                              return
                            }
                            deleteChapterMutation.mutate(chapter.id)
                          },
                        },
                      ]}
                    />
                  </div>
                  <h2
                    className={css`
                      font-size: ${typography.h3};
                      color: ${baseTheme.colors.grey[500]};
                      text-align: center;
                      text-transform: uppercase;
                      margin-bottom: 5rem;
                    `}
                  >
                    {t("title-chapter", {
                      "chapter-number": chapter.chapter_number,
                      "chapter-name": chapter.name,
                    })}
                  </h2>
                  <FrontPage
                    data={pageOrderState.chapterIdToFrontPage?.[chapter.id]}
                    pageOrderDispatch={pageOrderDispatch}
                    chapter={chapter}
                    refetch={refetch}
                  />
                  <PageList
                    data={pageOrderState.chapterIdToPages?.[chapter.id] ?? []}
                    pageOrderDispatch={pageOrderDispatch}
                    refetch={refetch}
                    courseId={courseStructure.course.id}
                    chapter={chapter}
                  />
                </Centered>
              </div>
            </BreakFromCentered>
          ))}

        <Button
          variant="primary"
          size="medium"
          onClick={() => setShowEditChapterForm(!showEditChapterForm)}
        >
          {t("button-text-new-chapter")}
        </Button>

        <Dialog
          open={!!showEditChapterForm}
          onClose={() => {
            setChapterBeingEdited(null)
            setShowEditChapterForm(false)
          }}
        >
          <div
            className={css`
              margin: 1rem;
            `}
          >
            <Button
              variant="primary"
              size="medium"
              onClick={() => {
                setChapterBeingEdited(null)
                setShowEditChapterForm(false)
              }}
            >
              {t("button-text-close")}
            </Button>
            <NewChapterForm
              courseId={courseStructure.course.id}
              onSubmitForm={handleCreateChapter}
              chapterNumber={chapterBeingEdited?.chapter_number ?? (maxPart ?? 0) + 1}
              initialData={chapterBeingEdited}
              newRecord={!chapterBeingEdited}
            />
          </div>
        </Dialog>

        <Dialog
          open={!!showEditImageModal}
          onClose={() => {
            setChapterBeingEdited(null)
            setShowEditImageModal(false)
          }}
        >
          <div
            className={css`
              margin: 1rem;
            `}
          >
            <Button
              variant="primary"
              size="medium"
              onClick={() => {
                setChapterBeingEdited(null)
                setShowEditImageModal(false)
              }}
            >
              {t("button-text-close")}
            </Button>
            {chapterBeingEdited && (
              <ChapterImageWidget chapter={chapterBeingEdited} onChapterUpdated={() => refetch()} />
            )}
          </div>
        </Dialog>
      </div>
      <DebugModal data={courseStructure} />
      {pageOrderState.unsavedChanges && (
        <div
          className={css`
            padding: 1rem 2rem;
            position: fixed;
            bottom: 0px;
            margin: 5% auto;
            left: 0;
            right: 0;
            width: 90%;
            max-width: fit-content;
            z-index: 20;
            background-color: ${baseTheme.colors.clear[100]};
            box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.26);
            border-radius: 2px;
          `}
        >
          <div
            className={css`
              margin-top: 0.4rem;
              margin-bottom: 0.6rem;
              display: flex;
              align-items: center;
              font-weight: 600;
              color: ${baseTheme.colors.grey[500]};
            `}
          >
            <FontAwesomeIcon
              icon={faExclamationCircle}
              className={css`
                font-size: 40px;
                margin-right: 1rem;
                color: ${baseTheme.colors.grey[600]};
              `}
            />
            {t("message-do-you-want-to-save-the-changes-to-the-page-ordering")}
          </div>
          <div>
            <Button
              variant="blue"
              size="medium"
              className={css`
                margin-left: 55px;
                margin-right: 0.5rem;
              `}
              onClick={() => {
                postNewPageOrderingMutation.mutate()
              }}
            >
              {t("button-text-save")}
            </Button>
            <Button
              variant="secondary"
              size="medium"
              onClick={() => {
                // eslint-disable-next-line i18next/no-literal-string
                pageOrderDispatch({ type: "setData", payload: courseStructure })
              }}
            >
              {t("button-reset")}
            </Button>
          </div>
        </div>
      )}
    </>
  )
}

export default ManageCourseStructure

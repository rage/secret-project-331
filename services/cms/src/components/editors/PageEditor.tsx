"use client"

/* oxlint-disable i18next/no-literal-string */
import { css } from "@emotion/css"
import type { UseMutationResult } from "@tanstack/react-query"
import { useQuery } from "@tanstack/react-query"
import { isEqual } from "lodash"
import { useRouter } from "next/router"
import React, { useMemo, useReducer, useState } from "react"

import {
  blockTypeMapForFrontPages,
  blockTypeMapForPages,
  blockTypeMapForTopLevelPages,
} from "../../blocks"
import { allowedBlockVariants, supportedCoreBlocks } from "../../blocks/supportedGutenbergBlocks"
import { EditorContentDispatch, editorContentReducer } from "../../contexts/EditorContentContext"
import usePageInfo from "../../hooks/usePageInfo"
import mediaUploadBuilder from "../../services/mediaUpload"
import { modifyBlocks, removeUncommonSpacesFromBlocks } from "../../utils/Gutenberg/modifyBlocks"
import { removeUnsupportedBlockType } from "../../utils/Gutenberg/removeUnsupportedBlockType"
import { denormalizeDocument, normalizeDocument } from "../../utils/documentSchemaProcessor"
import { makeSurePeerOrSelfReviewConfigAdditionalInstructionsAreNullInsteadOfEmptyLookingArray } from "../../utils/peerOrSelfReviewConfig"
import { coursePageRoute } from "../../utils/routing"
import CmsPageTitle from "../CmsPageTitle"
import UpdatePageDetailsForm from "../forms/UpdatePageDetailsForm"

import HeadingHierarchyButton from "./HeadingHierarchyButton"

import type { CmsPageUpdate, ContentManagementPage, Page } from "@/generated/api"
import {
  getCmsCourseOptions,
  getCmsPageNavigationOptions,
} from "@/generated/api/@tanstack/react-query.generated"
import Button from "@/shared-module/common/components/Button"
import BreakFromCentered from "@/shared-module/common/components/Centering/BreakFromCentered"
import DebugModal from "@/shared-module/common/components/DebugModal"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import Menu from "@/shared-module/common/components/Navigation/NavBar/Menu/Menu"
import { useDialog } from "@/shared-module/common/components/dialogs/DialogProvider"
import dynamicImport from "@/shared-module/common/utils/dynamicImport"
import { joinTitleSegments } from "@/shared-module/common/utils/pageTitle"
import { pageRoute } from "@/shared-module/common/utils/routes"
import { isGutenbergBlockArray } from "@/utils/Gutenberg/gutenbergBlocks"
import type { BlockInstance } from "@/utils/Gutenberg/types"
import { optionalGeneratedQueryOptions } from "@/utils/optionalGeneratedQueryOptions"
import { useTranslation } from "@/utils/useCmsTranslation"

interface PageEditorProps {
  data: Page
  courseCanAddChatbot: boolean
  saveMutation: UseMutationResult<ContentManagementPage, unknown, CmsPageUpdate, unknown>
  needToRunMigrationsAndValidations: boolean
  setNeedToRunMigrationsAndValidations: React.Dispatch<boolean>
}

const GutenbergEditor = dynamicImport(() => import("./GutenbergEditor"))

const supportedBlocks = (chapter_id: string | null, exam_id: string | null): string[] => {
  const supportedBlocksForPages: string[] = blockTypeMapForPages.map((mapping) => mapping[0])
  const supportedBlocksTopLevelPages: string[] = blockTypeMapForTopLevelPages.map(
    (mapping) => mapping[0],
  )

  const allSupportedBlocks =
    chapter_id || exam_id
      ? supportedCoreBlocks.concat(supportedBlocksForPages)
      : supportedCoreBlocks.concat(supportedBlocksTopLevelPages)

  return allSupportedBlocks
}

const customBlocks = (
  chapterId: string | null,
  examId: string | null,
  urlPath: string,
  canAddChatbot: boolean,
  chapterLockingEnabled: boolean,
) => {
  if (chapterId !== null || examId !== null) {
    let blocks = blockTypeMapForPages
    if (!chapterLockingEnabled) {
      blocks = blocks.filter((v) => v[0] !== "moocfi/lock-chapter")
    }
    if (!canAddChatbot) {
      blocks = blocks.filter((v) => v[0] !== "moocfi/chatbot")
    }
    return blocks
  }
  if (urlPath === "/") {
    return blockTypeMapForFrontPages
  }
  return blockTypeMapForTopLevelPages
}

const PageEditor: React.FC<React.PropsWithChildren<PageEditorProps>> = ({
  data,
  courseCanAddChatbot,
  saveMutation,
  needToRunMigrationsAndValidations,
  setNeedToRunMigrationsAndValidations,
}) => {
  const { confirm } = useDialog()
  const { t } = useTranslation()
  const router = useRouter()
  const prefix = router.asPath ? (router.asPath.split("/")[1] ?? "") : ""
  const pageInfo = usePageInfo(data.id, prefix)
  const [title, setTitle] = useState(data.title)
  const savedTitle = data.title
  const savedContent = modifyBlocks(
    data.content as BlockInstance[],
    supportedBlocks(data.chapter_id ?? null, data.exam_id ?? null),
  ) as BlockInstance[]
  const [content, contentDispatch] = useReducer(
    editorContentReducer,
    modifyBlocks(
      savedContent,
      supportedBlocks(data.chapter_id ?? null, data.exam_id ?? null),
    ) as BlockInstance[],
  )
  const currentContentStateSaved = isEqual(savedContent, content) && savedTitle === title
  const [currentlySaving, setCurrentlySaving] = useState(false)
  const handleOnSave = () => {
    setCurrentlySaving(true)
    const dataToSave = normalizeDocument({
      chapterId: data.chapter_id ?? null,
      content: removeUncommonSpacesFromBlocks(removeUnsupportedBlockType(content)),
      title,
      urlPath: data.url_path,
      hidden: data.hidden,
    })
    // Make sure peer review configs are valid
    for (const exercise of dataToSave.exercises) {
      if (exercise.peer_or_self_review_config) {
        exercise.peer_or_self_review_config =
          makeSurePeerOrSelfReviewConfigAdditionalInstructionsAreNullInsteadOfEmptyLookingArray(
            exercise.peer_or_self_review_config,
          )
      }
    }
    saveMutation.mutate(dataToSave, {
      onSuccess: (saveResult) => {
        if (!isGutenbergBlockArray(saveResult.page.content)) {
          throw new Error("Content is not a GutenbergBlock array")
        }
        contentDispatch({
          type: "setContent",
          payload: denormalizeDocument({
            content: saveResult.page.content,
            exercises: saveResult.exercises,
            exercise_slides: saveResult.exercise_slides,
            exercise_tasks: saveResult.exercise_tasks,
            url_path: saveResult.page.url_path,
            title: saveResult.page.title,
            chapter_id: saveResult.page.chapter_id,
            hidden: saveResult.page.hidden,
          }).content,
        })
        setNeedToRunMigrationsAndValidations(true)
      },
      onSettled: () => {
        setCurrentlySaving(false)
      },
    })
  }

  let mediaUpload
  if (data.course_id) {
    mediaUpload = mediaUploadBuilder({ courseId: data.course_id })
  } else if (data.exam_id) {
    mediaUpload = mediaUploadBuilder({ examId: data.exam_id })
  } else {
    throw new Error(
      "The backend should ensure that a page is associated with either a course or an exam",
    )
  }

  const getNextPageRoutingData = useQuery(
    getCmsPageNavigationOptions({
      path: {
        page_id: data.id,
      },
    }),
  )

  const courseQuery = useQuery(
    optionalGeneratedQueryOptions({
      value: data.course_id,
      isReady: (courseId): courseId is string => Boolean(courseId),
      build: (courseId) =>
        getCmsCourseOptions({
          path: {
            course_id: courseId,
          },
        }),
    }),
  )

  const chapterLockingEnabled = courseQuery.data?.chapter_locking_enabled ?? false

  const pageRoutingData = getNextPageRoutingData.data
  const nextPageUrl =
    pageRoutingData && pageRoutingData.next_page
      ? coursePageRoute(pageRoutingData.next_page.page_id)
      : coursePageRoute(data.id)
  const saveAndReset = (
    <div>
      {pageInfo.data && pageInfo.data.organization_slug && pageInfo.data.course_slug && (
        <a
          className={css`
            display: block;
            margin-bottom: 1rem;
          `}
          href={pageRoute(pageInfo.data, data.url_path)}
          target="_blank"
          rel="noopener noreferrer"
        >
          <Button
            variant={"secondary"}
            size={"medium"}
            transform="none"
            className={css`
              width: 100%;
            `}
          >
            {t("open-saved-page-in-new-tab")}
          </Button>
        </a>
      )}
      <div
        className={css`
          display: flex;
          justify-content: center;
          background: #f5f6f7;
          padding: 1rem;
        `}
      >
        <Button
          variant="primary"
          size="medium"
          className={css`
            margin-right: 1rem;
            border: 1px black solid;
            pointer-events: auto;
          `}
          onClick={handleOnSave}
          disabled={currentContentStateSaved || currentlySaving}
        >
          {t("save")}
        </Button>
        <Button
          variant="secondary"
          size="medium"
          className={css`
            margin-left: 1rem;
            border: 1px black solid;
            pointer-events: auto;
          `}
          onClick={async () => {
            const res = await confirm(t("are-you-sure-you-want-to-discard-changes"))
            if (res) {
              contentDispatch({ type: "setContent", payload: savedContent })
            }
          }}
          disabled={currentContentStateSaved || currentlySaving}
        >
          {t("reset")}
        </Button>
        <Menu variant="bottom">
          <li>
            <a href={nextPageUrl}>
              <Button size="medium" variant="primary">
                {t("next-page")}
              </Button>
            </a>
          </li>
        </Menu>
      </div>
    </div>
  )
  const inspectorButtons = (
    <>
      <HeadingHierarchyButton content={content} />
      {saveAndReset}
    </>
  )
  const memoizedCustomBlocks = useMemo(
    () =>
      customBlocks(
        data.chapter_id ?? null,
        data.exam_id ?? null,
        data.url_path,
        courseCanAddChatbot,
        chapterLockingEnabled,
      ),
    [data.chapter_id, data.exam_id, data.url_path, courseCanAddChatbot, chapterLockingEnabled],
  )
  return (
    <EditorContentDispatch.Provider value={contentDispatch}>
      <CmsPageTitle
        title={joinTitleSegments([
          title.trim() ? t("editing-page", { title }) : t("edit"),
          pageInfo.data?.course_name,
        ])}
      />
      <BreakFromCentered sidebar={false}>
        <div className="editor__top-button-wrapper">{saveAndReset}</div>
      </BreakFromCentered>
      <div className="editor__component">
        <div>
          {saveMutation.isError && <ErrorBanner variant={"text"} error={saveMutation.error} />}
          <UpdatePageDetailsForm title={title} setTitle={setTitle} />
        </div>
      </div>
      <div>
        <GutenbergEditor
          content={content}
          onContentChange={(value) => contentDispatch({ type: "setContent", payload: value })}
          customBlocks={memoizedCustomBlocks}
          allowedBlocks={supportedCoreBlocks}
          allowedBlockVariations={allowedBlockVariants}
          mediaUpload={mediaUpload}
          inspectorButtons={inspectorButtons}
          needToRunMigrationsAndValidations={needToRunMigrationsAndValidations}
          setNeedToRunMigrationsAndValidations={setNeedToRunMigrationsAndValidations}
        />
      </div>
      <div className="editor__component">
        <div
          className={css`
            margin-top: 1rem;
            margin-bottom: 1rem;
          `}
        >
          <DebugModal
            data={content}
            readOnly={false}
            updateDataOnClose={(updatedContent) =>
              contentDispatch({ type: "setContent", payload: updatedContent })
            }
          />
        </div>
      </div>
    </EditorContentDispatch.Provider>
  )
}
export default PageEditor

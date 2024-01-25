/* eslint-disable i18next/no-literal-string */
import { css } from "@emotion/css"
import { UseMutationResult, useQuery } from "@tanstack/react-query"
import { BlockInstance } from "@wordpress/blocks"
import { isEqual } from "lodash"
import dynamic from "next/dynamic"
import { useRouter } from "next/router"
import React, { useReducer, useState } from "react"
import { useTranslation } from "react-i18next"

import {
  blockTypeMapForFrontPages,
  blockTypeMapForPages,
  blockTypeMapForTopLevelPages,
} from "../../blocks"
import { allowedBlockVariants, supportedCoreBlocks } from "../../blocks/supportedGutenbergBlocks"
import { EditorContentDispatch, editorContentReducer } from "../../contexts/EditorContentContext"
import usePageInfo from "../../hooks/usePageInfo"
import mediaUploadBuilder from "../../services/backend/media/mediaUpload"
import { fetchNextPageRoutingData } from "../../services/backend/pages"
import { CmsPageUpdate, ContentManagementPage, Page } from "../../shared-module/common/bindings"
import Button from "../../shared-module/common/components/Button"
import BreakFromCentered from "../../shared-module/common/components/Centering/BreakFromCentered"
import DebugModal from "../../shared-module/common/components/DebugModal"
import ErrorBanner from "../../shared-module/common/components/ErrorBanner"
import Menu from "../../shared-module/common/components/Navigation/NavBar/Menu/Menu"
import Spinner from "../../shared-module/common/components/Spinner"
import { pageRoute } from "../../shared-module/common/utils/routes"
import { modifyBlocks } from "../../utils/Gutenberg/modifyBlocks"
import { removeUnsupportedBlockType } from "../../utils/Gutenberg/removeUnsupportedBlockType"
import { denormalizeDocument, normalizeDocument } from "../../utils/documentSchemaProcessor"
import { coursePageRoute } from "../../utils/routing"
import SerializeGutenbergModal from "../SerializeGutenbergModal"
import UpdatePageDetailsForm from "../forms/UpdatePageDetailsForm"

interface PageEditorProps {
  data: Page
  saveMutation: UseMutationResult<ContentManagementPage, unknown, CmsPageUpdate, unknown>
  needToRunMigrationsAndValidations: boolean
  setNeedToRunMigrationsAndValidations: React.Dispatch<boolean>
}

const EditorLoading = <Spinner variant="medium" />

const GutenbergEditor = dynamic(() => import("./GutenbergEditor"), {
  ssr: false,
  loading: () => EditorLoading,
})

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

const PageEditor: React.FC<React.PropsWithChildren<PageEditorProps>> = ({
  data,
  saveMutation,
  needToRunMigrationsAndValidations,
  setNeedToRunMigrationsAndValidations,
}) => {
  const { t } = useTranslation()
  const router = useRouter()
  const prefix = router.asPath.split("/")[1]
  const pageInfo = usePageInfo(data.id, prefix)
  const [title, setTitle] = useState(data.title)
  const savedTitle = data.title
  const savedContent = modifyBlocks(
    data.content as BlockInstance[],
    supportedBlocks(data.chapter_id, data.exam_id),
  ) as BlockInstance[]
  const [content, contentDispatch] = useReducer(
    editorContentReducer,
    modifyBlocks(savedContent, supportedBlocks(data.chapter_id, data.exam_id)) as BlockInstance[],
  )
  const currentContentStateSaved = isEqual(savedContent, content) && savedTitle === title
  const [currentlySaving, setCurrentlySaving] = useState(false)
  const handleOnSave = async () => {
    setCurrentlySaving(true)
    saveMutation.mutate(
      normalizeDocument({
        chapterId: data.chapter_id,
        content: removeUnsupportedBlockType(content),
        title,
        urlPath: data.url_path,
      }),
      {
        onSuccess: (data) => {
          contentDispatch({
            type: "setContent",
            payload: denormalizeDocument({
              content: data.page.content,
              exercises: data.exercises,
              exercise_slides: data.exercise_slides,
              exercise_tasks: data.exercise_tasks,
              url_path: data.page.url_path,
              title: data.page.title,
              chapter_id: data.page.chapter_id,
            }).content,
          })
          setNeedToRunMigrationsAndValidations(true)
        },
        onSettled: () => {
          setCurrentlySaving(false)
        },
      },
    )
  }

  let mediaUpload
  if (data.course_id) {
    mediaUpload = mediaUploadBuilder({ courseId: data.course_id })
  } else if (data.exam_id) {
    mediaUpload = mediaUploadBuilder({ examId: data.exam_id })
  } else {
    throw "The backend should ensure that a page is associated with either a course or an exam"
  }

  const getNextPageRoutingData = useQuery({
    queryKey: [`pages-${data.id}-page-navigation`],
    queryFn: () => fetchNextPageRoutingData(data.id),
  })

  const pageRoutingData = getNextPageRoutingData.data
  let nextPageUrl = "/"

  if (pageRoutingData && pageRoutingData.next_page) {
    nextPageUrl = coursePageRoute(pageRoutingData.next_page.page_id)
  } else {
    nextPageUrl = coursePageRoute(data.id)
  }
  const saveAndReset = (
    <div>
      {pageInfo.data && (
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
          onClick={() => {
            const res = confirm(t("are-you-sure-you-want-to-discard-changes"))
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
                {"next-page"}
              </Button>
            </a>
          </li>
        </Menu>
      </div>
    </div>
  )
  return (
    <EditorContentDispatch.Provider value={contentDispatch}>
      <BreakFromCentered sidebar={false}>
        <div className="editor__top-button-wrapper">{saveAndReset}</div>
      </BreakFromCentered>
      <div className="editor__component">
        <div>
          {saveMutation.isError && <ErrorBanner error={saveMutation.error} />}
          <UpdatePageDetailsForm title={title} setTitle={setTitle} />
        </div>
      </div>
      <div>
        <GutenbergEditor
          content={content}
          onContentChange={(value) => contentDispatch({ type: "setContent", payload: value })}
          customBlocks={
            data.chapter_id !== null || data.exam_id !== null
              ? blockTypeMapForPages
              : data.url_path === "/"
                ? blockTypeMapForFrontPages
                : blockTypeMapForTopLevelPages
          }
          allowedBlocks={supportedCoreBlocks}
          allowedBlockVariations={allowedBlockVariants}
          mediaUpload={mediaUpload}
          inspectorButtons={saveAndReset}
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
          <div
            className={css`
              margin-bottom: 0.5rem;
            `}
          >
            <SerializeGutenbergModal content={content} />
          </div>
          <DebugModal
            data={content}
            readOnly={false}
            updateDataOnClose={(data) => contentDispatch({ type: "setContent", payload: data })}
          />
        </div>
      </div>
    </EditorContentDispatch.Provider>
  )
}
export default PageEditor

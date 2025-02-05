import { css } from "@emotion/css"
import styled from "@emotion/styled"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import { ManagePageOrderAction } from "../../../../../../../reducers/managePageOrderReducer"
import NewOrEditPageForm from "../NewOrEditPageForm"

import PageAudioWidget from "./PageAudioWidget"

import { Chapter, Page } from "@/shared-module/common/bindings"
import DropdownMenu from "@/shared-module/common/components/DropdownMenu"
import { baseTheme } from "@/shared-module/common/styles"

export const MOVING_ALLOWED: MovePolicy = "allowed"
export const MOVING_NOT_ALLOWED: MovePolicy = "not-allowed"
export const MOVING_ALLOWED_ONLY_UP: MovePolicy = "only-up"
export const MOVING_ALLOWED_ONLY_DOWN: MovePolicy = "only-down"

export type MovePolicy = "allowed" | "not-allowed" | "only-up" | "only-down"

interface PageListItemProps {
  page: Page
  pageOrderDispatch: React.Dispatch<ManagePageOrderAction>
  onDeletePage: (() => void) | null
  moving: MovePolicy
  chapter: Chapter | undefined
  reload: () => void
}

// eslint-disable-next-line i18next/no-literal-string
const ActionButton = styled.button`
  color: ${baseTheme.colors.gray[600]};
  background: #ffffff;
  border: 1px solid ${baseTheme.colors.clear[400]};
  border-radius: 5px;
  margin: 0 0.2rem;
  padding: 0.2rem 0.5rem;
  cursor: pointer;

  &:hover {
    filter: brightness(92%) contrast(110%);
  }
`

const PageListItem: React.FC<React.PropsWithChildren<PageListItemProps>> = ({
  page,
  pageOrderDispatch,
  moving,
  onDeletePage,
  chapter,
  reload,
}) => {
  const { t } = useTranslation()
  const [showDialog, setShowDialog] = useState<boolean>(false)
  const [showEditPageDetailsForm, setShowEditDetailsPageForm] = useState(false)

  const canMoveUp = moving === "allowed" || moving === "only-up"
  const canMoveDown = moving === "allowed" || moving === "only-down"
  // Editing the path of front pages or chapter front pages is not allowed
  const canEditPageDetails = canMoveUp || canMoveDown

  return (
    <>
      {showDialog && (
        <PageAudioWidget id={page.id} open={showDialog} onClose={() => setShowDialog(false)} />
      )}
      <NewOrEditPageForm
        courseId={page.course_id ?? ""}
        onSubmitForm={() => {
          setShowEditDetailsPageForm(false)
          reload()
        }}
        isUpdate={true}
        savedPage={page}
        // eslint-disable-next-line i18next/no-literal-string
        prefix={chapter && `/chapter-${chapter.chapter_number}/`}
        open={showEditPageDetailsForm}
        onClose={() => setShowEditDetailsPageForm(false)}
      />
      <tr
        className={css`
          border: 1px solid ${baseTheme.colors.clear[300]};
        `}
        key={page.id}
      >
        <td
          className={css`
            padding: 1rem;
          `}
        >
          {page.title}
        </td>
        <td
          className={css`
            padding: 1rem;
          `}
        >
          {page.url_path}
        </td>
        <td>{page.hidden ? t("yes") : ""}</td>
        <td
          className={css`
            padding: 1rem;
          `}
        >
          <div
            className={css`
              display: flex;
              justify-content: flex-end;
            `}
          >
            <a href={`/cms/pages/${page.id}`}>
              <ActionButton>{t("button-text-edit-page")}</ActionButton>
            </a>
            <DropdownMenu
              items={[
                canEditPageDetails
                  ? {
                      label: t("button-text-edit-page-details"),
                      onClick: () => {
                        setShowEditDetailsPageForm(true)
                      },
                    }
                  : null,
                {
                  label: t("link-history"),
                  // eslint-disable-next-line i18next/no-literal-string
                  href: `/manage/pages/${page.id}/history`,
                },
                {
                  label: t("upload-audio-file"),

                  onClick: () => {
                    setShowDialog(true)
                  },
                },
                canMoveUp
                  ? {
                      label: t("button-text-move-up"),
                      onClick: () => {
                        pageOrderDispatch({
                          type: "move",
                          // eslint-disable-next-line i18next/no-literal-string
                          payload: { pageId: page.id, chapterId: page.chapter_id, direction: "up" },
                        })
                      },
                    }
                  : null,
                canMoveDown
                  ? {
                      label: t("button-text-move-down"),
                      onClick: () => {
                        pageOrderDispatch({
                          type: "move",
                          payload: {
                            pageId: page.id,
                            chapterId: page.chapter_id,
                            // eslint-disable-next-line i18next/no-literal-string
                            direction: "down",
                          },
                        })
                      },
                    }
                  : null,
                onDeletePage && {
                  label: t("button-text-delete"),
                  onClick: () => {
                    onDeletePage()
                  },
                },
              ]}
            />
          </div>
        </td>
      </tr>
    </>
  )
}

export default PageListItem

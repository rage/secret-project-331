import { horizontalListSortingStrategy, SortableContext } from "@dnd-kit/sortable"
import { css } from "@emotion/css"
import styled from "@emotion/styled"
import { Dialog } from "@mui/material"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import { ManagePageOrderAction } from "../../../../../../../reducers/managePageOrderReducer"
import { deletePage } from "../../../../../../../services/backend/pages"
import { Chapter, Page } from "../../../../../../../shared-module/bindings"
import Button from "../../../../../../../shared-module/components/Button"
import { baseTheme, typography } from "../../../../../../../shared-module/styles"
import { respondToOrLarger } from "../../../../../../../shared-module/styles/respond"
import NewPageForm from "../NewPageForm"

import PageListItem, {
  MOVING_ALLOWED,
  MOVING_ALLOWED_ONLY_DOWN,
  MOVING_ALLOWED_ONLY_UP,
  MOVING_NOT_ALLOWED,
} from "./PageListItem"
import TableWrapper from "./TableWrapper"

const DeleteButton = styled.button`
  border: 0;
  border: none;
  background-color: transparent;
  outline: none;
  cursor: pointer;
`

interface Props {
  data: Page[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  refetch: () => any
  courseId: string
  chapter?: Chapter
  pageOrderDispatch: React.Dispatch<ManagePageOrderAction>
}

const PageList: React.FC<Props> = ({ data, refetch, courseId, chapter, pageOrderDispatch }) => {
  const { t } = useTranslation()
  const [showNewPageForm, setShowNewPageForm] = useState(false)
  const handleCreateTopLevelPage = () => {
    setShowNewPageForm(!showNewPageForm)
    refetch()
  }

  const handleDeletePage = async (pageId: string, title: string) => {
    const result = confirm(t("page-deletion-confirmation-message", { title }))
    if (result) {
      await deletePage(pageId)
      refetch()
    }
  }

  const items = data.filter((page) => !page.deleted_at)
  return (
    <div
      className={css`
        margin: 2rem 0;
        border: 2px solid ${baseTheme.colors.clear[500]};
        border-radius: 12px;
        background-color: white;
        padding: 2rem 1rem;

        ${respondToOrLarger.sm} {
          padding: 2rem 2rem;
        }

        ${respondToOrLarger.md} {
          padding: 2rem 3rem;
        }
      `}
    >
      <h3
        className={css`
          font-size: ${typography.h5};
          text-transform: uppercase;
        `}
      >
        {chapter ? "Pages in this chapter" : "Top level pages"}
      </h3>
      <TableWrapper>
        {items.map((page: Page, n) => {
          let moving = MOVING_ALLOWED
          if (n === 0) {
            moving = MOVING_ALLOWED_ONLY_DOWN
          }
          if (n === items.length - 1) {
            moving = MOVING_ALLOWED_ONLY_UP
          }
          if (items.length - 1 === 0) {
            moving = MOVING_NOT_ALLOWED
          }

          return (
            <PageListItem
              page={page}
              key={page.id}
              pageOrderDispatch={pageOrderDispatch}
              onDeletePage={() => handleDeletePage(page.id, page.title)}
              // eslint-disable-next-line i18next/no-literal-string
              moving={moving}
            />
          )
        })}
      </TableWrapper>
      <Button size="medium" variant="primary" onClick={() => setShowNewPageForm(!showNewPageForm)}>
        {t("button-text-new")}
      </Button>

      <Dialog open={showNewPageForm} onClose={() => setShowNewPageForm(!showNewPageForm)}>
        <div
          className={css`
            margin: 1rem;
          `}
        >
          <Button
            size="medium"
            variant="secondary"
            onClick={() => setShowNewPageForm(!showNewPageForm)}
          >
            {t("button-text-close")}
          </Button>
          <NewPageForm
            chapterId={chapter?.id}
            courseId={courseId}
            onSubmitForm={handleCreateTopLevelPage}
            // eslint-disable-next-line i18next/no-literal-string
            prefix={chapter && `/chapter-${chapter.chapter_number}/`}
          />
        </div>
      </Dialog>
    </div>
  )
}

export default PageList

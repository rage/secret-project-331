import { horizontalListSortingStrategy, SortableContext } from "@dnd-kit/sortable"
import { css } from "@emotion/css"
import styled from "@emotion/styled"
import { faTrash } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { Dialog } from "@mui/material"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import { deletePage } from "../../../../../../../services/backend/pages"
import { Chapter, Page } from "../../../../../../../shared-module/bindings"
import Button from "../../../../../../../shared-module/components/Button"
import { baseTheme, typography } from "../../../../../../../shared-module/styles"
import NewPageForm from "../NewPageForm"

import Droppable from "./Droppable"
import PageListItem from "./PageListItem"

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
}

const PageList: React.FC<Props> = ({ data, refetch, courseId, chapter }) => {
  const { t } = useTranslation()
  const [showNewPageForm, setShowNewPageForm] = useState(false)
  const handleCreateTopLevelPage = () => {
    setShowNewPageForm(!showNewPageForm)
    refetch()
  }

  const handleDeleteTopLevelPage = async (pageId: string, name: string) => {
    const result = confirm(t("page-deletion-confirmation-message", { name }))
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
        padding: 2rem 3rem;
      `}
    >
      <h3
        className={css`
          font-size: ${typography.h5};
          text-transform: uppercase;
        `}
      >
        Pages in this chapter
      </h3>
      <ul
        className={css`
          list-style: none;
          padding-left: 0;
        `}
      >
        <SortableContext items={items} strategy={horizontalListSortingStrategy}>
          {items.map((page: Page) => (
            <PageListItem page={page} key={page.id} />
          ))}
          <Droppable />
        </SortableContext>
      </ul>
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

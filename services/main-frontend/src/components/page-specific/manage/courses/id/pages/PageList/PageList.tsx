import { css } from "@emotion/css"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import { ManagePageOrderAction } from "../../../../../../../reducers/managePageOrderReducer"
import { deletePage } from "../../../../../../../services/backend/pages"
import { Chapter, Page } from "../../../../../../../shared-module/bindings"
import Button from "../../../../../../../shared-module/components/Button"
import Dialog from "../../../../../../../shared-module/components/Dialog"
import useToastMutation from "../../../../../../../shared-module/hooks/useToastMutation"
import { baseTheme, typography } from "../../../../../../../shared-module/styles"
import { respondToOrLarger } from "../../../../../../../shared-module/styles/respond"
import NewOrEditPageForm from "../NewOrEditPageForm"

import PageListItem, {
  MOVING_ALLOWED,
  MOVING_ALLOWED_ONLY_DOWN,
  MOVING_ALLOWED_ONLY_UP,
  MOVING_NOT_ALLOWED,
} from "./PageListItem"
import TableWrapper from "./TableWrapper"

interface Props {
  data: Page[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  refetch: () => any
  courseId: string
  chapter?: Chapter
  pageOrderDispatch: React.Dispatch<ManagePageOrderAction>
}

const PageList: React.FC<React.PropsWithChildren<Props>> = ({
  data,
  refetch,
  courseId,
  chapter,
  pageOrderDispatch,
}) => {
  const { t } = useTranslation()
  const [showNewOrEditPageForm, setShowNewOrEditPageForm] = useState(false)
  const deletePageMutation = useToastMutation(
    (pageId: string) => {
      return deletePage(pageId)
    },
    { notify: true, method: "DELETE" },
    { onSuccess: () => refetch() },
  )
  const handleCreateTopLevelPage = () => {
    setShowNewOrEditPageForm(false)
    refetch()
  }

  const handleDeletePage = async (pageId: string, title: string) => {
    const result = confirm(t("page-deletion-confirmation-message", { title }))
    if (result) {
      deletePageMutation.mutate(pageId)
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
        {chapter ? t("heading-pages-in-this-chapter") : t("heading-top-level-pages")}
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
              chapter={chapter}
              key={page.id}
              pageOrderDispatch={pageOrderDispatch}
              onDeletePage={() => handleDeletePage(page.id, page.title)}
              // eslint-disable-next-line i18next/no-literal-string
              moving={moving}
              reload={() => refetch()}
            />
          )
        })}
      </TableWrapper>
      <Button size="medium" variant="primary" onClick={() => setShowNewOrEditPageForm(true)}>
        {t("button-text-new-page")}
      </Button>

      <Dialog
        open={showNewOrEditPageForm}
        onClose={() => setShowNewOrEditPageForm(false)}
        noPadding
      >
        <div
          className={css`
            margin: 1rem;
          `}
        >
          <Button size="medium" variant="secondary" onClick={() => setShowNewOrEditPageForm(false)}>
            {t("button-text-close")}
          </Button>
          <NewOrEditPageForm
            chapterId={chapter?.id}
            courseId={courseId}
            onSubmitForm={handleCreateTopLevelPage}
            // eslint-disable-next-line i18next/no-literal-string
            prefix={chapter && `/chapter-${chapter.chapter_number}/`}
            isUpdate={false}
          />
        </div>
      </Dialog>
    </div>
  )
}

export default PageList

import { css } from "@emotion/css"
import styled from "@emotion/styled"
import { faTrash } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { Dialog } from "@material-ui/core"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import { deletePage } from "../../services/backend/pages"
import { Chapter, Page } from "../../shared-module/bindings"
import Button from "../../shared-module/components/Button"
import NewPageForm from "../forms/NewPageForm"

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
  return (
    <div
      className={css`
        margin-bottom: 1rem;
      `}
    >
      <ul
        className={css`
          list-style: none;
          padding-left: 0;
        `}
      >
        {data
          .filter((page) => !page.deleted_at)
          .map((page: Page) => (
            <li key={page.id}>
              <a href={`/cms/pages/${page.id}`}>{page.title}</a>({page.url_path}){" "}
              <a href={`/manage/pages/${page.id}/history`}>{t("link-history")}</a>
              <DeleteButton
                aria-label={t("button-text-delete")}
                onClick={() => handleDeleteTopLevelPage(page.id, page.title)}
              >
                <FontAwesomeIcon icon={faTrash} size="lg" />
              </DeleteButton>
            </li>
          ))}
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

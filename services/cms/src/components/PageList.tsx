import { css } from "@emotion/css"
import styled from "@emotion/styled"
import { faTrash } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { Button, Dialog } from "@material-ui/core"
import Link from "next/link"
import React, { useState } from "react"

import { deletePage } from "../services/backend/pages"
import { Chapter, Page } from "../shared-module/bindings"

import NewPageForm from "./forms/NewPageForm"

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

console.log("tests")

const PageList: React.FC<Props> = ({ data, refetch, courseId, chapter }) => {
  const [showNewPageForm, setShowNewPageForm] = useState(false)
  const handleCreateTopLevelPage = () => {
    setShowNewPageForm(!showNewPageForm)
    refetch()
  }

  const handleDeleteTopLevelPage = async (pageId: string, name: string) => {
    const result = confirm(`Want to delete ${name}?`)
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
              <Link
                href={{
                  pathname: "/pages/[id]",
                  query: { id: page.id },
                }}
              >
                {page.title}
              </Link>
              ({page.url_path})
              <DeleteButton onClick={() => handleDeleteTopLevelPage(page.id, page.title)}>
                <FontAwesomeIcon icon={faTrash} size="lg" />
              </DeleteButton>
            </li>
          ))}
      </ul>
      <Button onClick={() => setShowNewPageForm(!showNewPageForm)}>New page</Button>

      <Dialog open={showNewPageForm} onClose={() => setShowNewPageForm(!showNewPageForm)}>
        <div
          className={css`
            margin: 1rem;
          `}
        >
          <Button onClick={() => setShowNewPageForm(!showNewPageForm)}>Close</Button>
          <NewPageForm
            chapterId={chapter?.id}
            courseId={courseId}
            onSubmitForm={handleCreateTopLevelPage}
            prefix={chapter && `/chapter-${chapter.chapter_number}/`}
          />
        </div>
      </Dialog>
    </div>
  )
}

export default PageList

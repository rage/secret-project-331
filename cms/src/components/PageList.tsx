import React, { useState } from "react"

import Layout from "./Layout"
import Link from "next/link"
import useQueryParameter from "../hooks/useQueryParameter"
import { useQuery } from "react-query"
import { dontRenderUntilQueryParametersReady } from "../utils/dontRenderUntilQueryParametersReady"
import { Button, Dialog } from "@material-ui/core"
import NewPageForm from "./forms/NewPageForm"
import { CoursePart, Page } from "../services/services.types"
import { deletePage, postNewPage } from "../services/backend/pages"
import { fetchCourseStructure } from "../services/backend/courses"
import { normalWidthCenteredComponentStyles } from "../styles/componentStyles"
import { css } from "@emotion/css"
import NewPartForm from "./forms/NewPartForm"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faTrash } from "@fortawesome/free-solid-svg-icons"

import styled from "@emotion/styled"
import DebugModal from "./DebugModal"

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
  coursePart?: CoursePart
}

const PageList: React.FC<Props> = ({ data, refetch, courseId, coursePart }) => {
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
          .filter((page) => !page.deleted)
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
        <div>
          <Button onClick={() => setShowNewPageForm(!showNewPageForm)}>Close</Button>
          <NewPageForm
            coursePartId={coursePart?.id}
            courseId={courseId}
            onSubmitForm={handleCreateTopLevelPage}
            prefix={coursePart && `/part-${coursePart.part_number}/`}
          />
        </div>
      </Dialog>
    </div>
  )
}

export default PageList

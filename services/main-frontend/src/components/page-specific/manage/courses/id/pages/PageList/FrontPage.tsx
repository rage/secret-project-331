import { css } from "@emotion/css"
import React from "react"
import { useTranslation } from "react-i18next"

import { ManagePageOrderAction } from "../../../../../../../reducers/managePageOrderReducer"
import { Chapter, Page } from "../../../../../../../shared-module/bindings"
import { baseTheme, typography } from "../../../../../../../shared-module/styles"
import { respondToOrLarger } from "../../../../../../../shared-module/styles/respond"

import PageListItem, { MOVING_NOT_ALLOWED } from "./PageListItem"
import TableWrapper from "./TableWrapper"

interface Props {
  data: Page | null | undefined
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  refetch: () => any
  chapter?: Chapter
  pageOrderDispatch: React.Dispatch<ManagePageOrderAction>
}

const FrontPage: React.FC<Props> = ({ data, chapter, pageOrderDispatch, refetch }) => {
  const { t } = useTranslation()

  if (!data) {
    return null
  }

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
        {chapter ? "Chapter front page" : "Course front page"}
      </h3>
      <TableWrapper>
        <PageListItem
          page={data}
          key={data.id}
          pageOrderDispatch={pageOrderDispatch}
          // Don't allow deleting front pages because the user cannot add them back at the moment
          onDeletePage={null}
          moving={MOVING_NOT_ALLOWED}
        />
      </TableWrapper>
    </div>
  )
}

export default FrontPage

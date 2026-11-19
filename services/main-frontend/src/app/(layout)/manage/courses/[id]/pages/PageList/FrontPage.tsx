"use client"

import { css } from "@emotion/css"
import React from "react"
import { useTranslation } from "react-i18next"

import type { Chapter, Page } from "@/generated/api/types.generated"
import type { ManagePageOrderAction } from "@/reducers/managePageOrderReducer"
import { baseTheme, typography } from "@/shared-module/common/styles"

import PagesTable from "./PagesTable"

interface Props {
  data: Page | null | undefined
  // oxlint-disable-next-line typescript/no-explicit-any
  refetch: () => any
  chapter?: Chapter
  pageOrderDispatch: React.Dispatch<ManagePageOrderAction>
}

const FrontPage: React.FC<React.PropsWithChildren<Props>> = ({
  data,
  chapter,
  pageOrderDispatch,
}) => {
  const { t } = useTranslation()
  if (!data) {
    return null
  }
  const caption = chapter ? t("heading-chapter-front-page") : t("heading-course-front-page")

  return (
    <div
      className={css`
        margin: 2rem 0;
        border: 2px solid ${baseTheme.colors.clear[500]};
        border-radius: 8px;
        background-color: white;
        padding: 1.4rem 1.25rem;
      `}
    >
      <h3
        className={css`
          font-size: ${typography.h5};
          font-size: 1.375rem;
          opacity: 0.8;
          font-weight: 550;
        `}
      >
        {caption}
      </h3>
      <PagesTable
        caption={caption}
        pages={[data]}
        chapter={chapter}
        pageOrderDispatch={pageOrderDispatch}
        // Front pages cannot be re-added once deleted
        onDeletePage={null}
        reload={() => undefined}
      />
    </div>
  )
}

export default FrontPage

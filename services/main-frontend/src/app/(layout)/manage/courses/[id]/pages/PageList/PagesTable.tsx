"use client"

import React from "react"
import { VisuallyHidden } from "react-aria"
import { useTranslation } from "react-i18next"

import { ALIGN_END } from "@/components/credit-registration/constants"
import type { Chapter, Page } from "@/generated/api/types.generated"
import type { ManagePageOrderAction } from "@/reducers/managePageOrderReducer"
import { Table } from "@/shared-module/components"

import PageRowActions, {
  MOVING_ALLOWED,
  MOVING_ALLOWED_ONLY_DOWN,
  MOVING_ALLOWED_ONLY_UP,
  MOVING_NOT_ALLOWED,
  type MovePolicy,
} from "./PageRowActions"

interface PagesTableProps {
  pages: Page[]
  chapter: Chapter | undefined
  pageOrderDispatch: React.Dispatch<ManagePageOrderAction>
  /** Null hides deletion, as for front pages. */
  onDeletePage: ((page: Page) => void) | null
  reload: () => void
  caption: string
}

function movePolicyAt(index: number, count: number): MovePolicy {
  if (count === 1) {
    return MOVING_NOT_ALLOWED
  }
  if (index === 0) {
    return MOVING_ALLOWED_ONLY_DOWN
  }
  if (index === count - 1) {
    return MOVING_ALLOWED_ONLY_UP
  }
  return MOVING_ALLOWED
}

const PagesTable: React.FC<PagesTableProps> = ({
  pages,
  chapter,
  pageOrderDispatch,
  onDeletePage,
  reload,
  caption,
}) => {
  const { t } = useTranslation()
  return (
    <Table
      caption={caption}
      rows={pages}
      rowKey={(page) => page.id}
      emptyState={null}
      columns={[
        { header: t("label-title"), cell: (page) => page.title, grow: true },
        { header: t("label-url-path"), cell: (page) => page.url_path, grow: true },
        { header: t("label-hidden"), cell: (page) => (page.hidden ? t("yes") : "") },
        {
          header: <VisuallyHidden>{t("label-actions")}</VisuallyHidden>,
          cell: (page) => (
            <PageRowActions
              page={page}
              chapter={chapter}
              pageOrderDispatch={pageOrderDispatch}
              onDeletePage={onDeletePage === null ? null : () => onDeletePage(page)}
              moving={movePolicyAt(pages.indexOf(page), pages.length)}
              reload={reload}
            />
          ),
          align: ALIGN_END,
        },
      ]}
    />
  )
}

export default PagesTable

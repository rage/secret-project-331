import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { css } from "@emotion/css"
import React from "react"
import { useTranslation } from "react-i18next"

import { Page } from "../../../../../../../shared-module/bindings"
import { baseTheme } from "../../../../../../../shared-module/styles"

interface PageListItemProps {
  page: Page
}

const PageListItem: React.FC<PageListItemProps> = ({ page }) => {
  const { t } = useTranslation()
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: page.id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }
  return (
    <li
      ref={setNodeRef}
      // eslint-disable-next-line react/forbid-dom-props
      style={style}
      className={css`
        background-color: ${baseTheme.colors.clear[100]};
        border: 1px solid ${baseTheme.colors.clear[300]};
        ${isDragging &&
        `z-index: 10;
        /* z-index requires positioning */
        position: relative;`}

        padding: 1rem;
        margin-bottom: 1rem;
        border-radius: 2px;
      `}
      key={page.id}
    >
      <a href={`/cms/pages/${page.id}`}>{page.title}</a>({page.url_path}){" "}
      <a href={`/manage/pages/${page.id}/history`}>{t("link-history")}</a>
      <button {...attributes} {...listeners}>
        Drag
      </button>
    </li>
  )
}

export default PageListItem

import { css } from "@emotion/css"
import styled from "@emotion/styled"
import React from "react"
import { useTranslation } from "react-i18next"

import { ManagePageOrderAction } from "../../../../../../../reducers/managePageOrderReducer"
import { Page } from "../../../../../../../shared-module/bindings"
import DropdownMenu from "../../../../../../../shared-module/components/DropdownMenu"
import { baseTheme } from "../../../../../../../shared-module/styles"

export const MOVING_ALLOWED: MovePolicy = "allowed"
export const MOVING_NOT_ALLOWED: MovePolicy = "not-allowed"
export const MOVING_ALLOWED_ONLY_UP: MovePolicy = "only-up"
export const MOVING_ALLOWED_ONLY_DOWN: MovePolicy = "only-down"

export type MovePolicy = "allowed" | "not-allowed" | "only-up" | "only-down"

interface PageListItemProps {
  page: Page
  pageOrderDispatch: React.Dispatch<ManagePageOrderAction>
  onDeletePage: (() => void) | null
  moving: MovePolicy
}

// eslint-disable-next-line i18next/no-literal-string
const ActionButton = styled.button`
  color: ${baseTheme.colors.gray[600]};
  background: #ffffff;
  border: 1px solid ${baseTheme.colors.clear[400]};
  border-radius: 5px;
  margin: 0 0.2rem;
  padding: 0.2rem 0.5rem;
  cursor: pointer;

  &:hover {
    filter: brightness(92%) contrast(110%);
  }
`

const PageListItem: React.FC<React.PropsWithChildren<PageListItemProps>> = ({
  page,
  pageOrderDispatch,
  moving,
  onDeletePage,
}) => {
  const { t } = useTranslation()

  const canMoveUp = moving === "allowed" || moving === "only-up"
  const canMoveDown = moving === "allowed" || moving === "only-down"

  return (
    <tr
      className={css`
        background-color: ${baseTheme.colors.clear[100]};
        border: 1px solid ${baseTheme.colors.clear[300]};
      `}
      key={page.id}
    >
      <td
        className={css`
          padding: 1rem;
        `}
      >
        {page.title}
      </td>
      <td
        className={css`
          padding: 1rem;
        `}
      >
        {page.url_path}
      </td>
      <td>{page.hidden ? t("yes") : ""}</td>
      <td
        className={css`
          padding: 1rem;
        `}
      >
        <div
          className={css`
            display: flex;
            justify-content: flex-end;
          `}
        >
          <a href={`/cms/pages/${page.id}`}>
            <ActionButton>{t("button-text-edit-page")}</ActionButton>
          </a>
          <DropdownMenu
            items={[
              {
                label: t("link-history"),
                // eslint-disable-next-line i18next/no-literal-string
                href: `/manage/pages/${page.id}/history`,
              },
              canMoveUp
                ? {
                    label: t("button-text-move-up"),
                    onClick: () => {
                      pageOrderDispatch({
                        // eslint-disable-next-line i18next/no-literal-string
                        type: "move",
                        // eslint-disable-next-line i18next/no-literal-string
                        payload: { pageId: page.id, chapterId: page.chapter_id, direction: "up" },
                      })
                    },
                  }
                : null,
              canMoveDown
                ? {
                    label: t("button-text-move-down"),
                    onClick: () => {
                      pageOrderDispatch({
                        // eslint-disable-next-line i18next/no-literal-string
                        type: "move",
                        payload: {
                          pageId: page.id,
                          chapterId: page.chapter_id,
                          // eslint-disable-next-line i18next/no-literal-string
                          direction: "down",
                        },
                      })
                    },
                  }
                : null,
              onDeletePage && {
                label: t("button-text-delete"),
                onClick: () => {
                  onDeletePage()
                },
              },
            ]}
          />
        </div>
      </td>
    </tr>
  )
}

export default PageListItem

import { css } from "@emotion/css"
import { faEllipsisV } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import { baseTheme } from "../../styles"

import DropdownMenuItem, { DropdownMenuItemType } from "./DropdownMenuItem"

export interface DropdownMenuProps {
  items: (DropdownMenuItemType | null)[]
}

const DropdownMenu: React.FC<
  React.PropsWithChildren<React.PropsWithChildren<DropdownMenuProps>>
> = ({ items }) => {
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState(false)
  return (
    <div
      className={css`
        position: relative;
        display: flex;
        align-items: center;
      `}
    >
      <button
        aria-expanded={expanded}
        onClick={() => {
          setExpanded(!expanded)
        }}
        className={css`
          background-color: transparent;
          border: none;
          color: ${baseTheme.colors.gray[400]};
          cursor: pointer;
          padding: 0 0.66em;
          margin: 0 0.66em;
          &:hover {
            background-color: ${baseTheme.colors.clear[200]};
            border-radius: 50px;
          }
        `}
        aria-label={expanded ? t("close") : t("dropdown-menu")}
      >
        <FontAwesomeIcon icon={faEllipsisV} />
      </button>
      {expanded && (
        <ul
          className={css`
            z-index: 200;
            box-shadow: 0px 8px 40px rgba(0, 0, 0, 0.1);
            width: fit-content;
            list-style: none;
            padding: 0;
            border-radius: 4px;
            overflow: hidden;
            margin: 0;
            font-size: 17px;
            position: absolute;
            top: 33px;
            left: 0;

            li + li {
              border-top: 2px solid ${baseTheme.colors.clear[200]};
            }

            li:hover {
              filter: brightness(92%) contrast(110%);
            }
          `}
        >
          {items
            .filter((item) => item !== null)
            .map((item) => {
              if (item === null) {
                return null
              }
              return (
                <DropdownMenuItem
                  key={item.label}
                  item={item}
                  closeMenu={() => {
                    setExpanded(false)
                  }}
                />
              )
            })}
        </ul>
      )}
    </div>
  )
}

export default DropdownMenu

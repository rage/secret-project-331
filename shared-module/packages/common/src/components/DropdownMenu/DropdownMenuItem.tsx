import { css } from "@emotion/css"
import Link from "next/link"
import React from "react"

import { baseTheme } from "../../styles"

interface DropdownMenuItemWithOnClick {
  label: string
  href?: undefined
  onClick: () => void
}

interface DropdownMenuItemWithHref {
  label: string
  href: string
  onClick?: undefined
}

export type DropdownMenuItemType = DropdownMenuItemWithOnClick | DropdownMenuItemWithHref

interface DropdownMenuProps {
  item: DropdownMenuItemType
  closeMenu: () => void
}

const itemInnerStyles = css`
  border: none;
  padding: 0.5rem 1.5rem;
  background-color: white;
  cursor: pointer;
  display: block;
  color: ${baseTheme.colors.gray[500]};
  font-weight: 600;
  text-decoration: none;
  width: 100%;
  white-space: nowrap;
  text-align: left;
  &:focus {
    filter: brightness(92%) contrast(110%);
    border: 2px solid black;
    outline: none;
  }
`

const DropdownMenuItem: React.FC<
  React.PropsWithChildren<React.PropsWithChildren<DropdownMenuProps>>
> = ({ item, closeMenu }) => {
  if (item.href) {
    return (
      <li>
        <Link href={item.href} className={itemInnerStyles}>
          {item.label}
        </Link>
      </li>
    )
  }
  return (
    <li>
      <button
        onClick={() => {
          try {
            if (item.onClick) {
              item.onClick()
            }
          } finally {
            closeMenu()
          }
        }}
        className={itemInnerStyles}
      >
        {item.label}
      </button>
    </li>
  )
}

export default DropdownMenuItem

import { css } from "@emotion/css"
import { faEllipsisV } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import React, { useCallback, useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { usePopper } from "react-popper"

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

  // This is the right way according to popper.js docs
  const [referenceElement, setReferenceElement] = useState<HTMLButtonElement | null>(null)
  const [popperElement, setPopperElement] = useState<HTMLDivElement | null>(null)

  const { styles, attributes } = usePopper(referenceElement, popperElement, {
    placement: "bottom-start",
    strategy: "fixed",
    modifiers: [
      {
        name: "offset",
        enabled: true,
        options: {
          offset: [0, 5],
        },
      },
      {
        name: "preventOverflow",
        enabled: true,
        options: {
          padding: 8,
        },
      },
      {
        name: "flip",
        enabled: true,
      },
    ],
  })

  const handleOutsideClick = useCallback(
    (event: MouseEvent) => {
      if (!expanded) {
        return
      }
      if (
        referenceElement &&
        (referenceElement.contains(event.target as Node) || referenceElement === event.target)
      ) {
        return
      }
      setExpanded(false)
    },
    [expanded, popperElement],
  )

  useEffect(() => {
    document.addEventListener("click", handleOutsideClick)
    return () => {
      document.removeEventListener("click", handleOutsideClick)
    }
  }, [handleOutsideClick])

  return (
    <div
      className={css`
        display: flex;
        align-items: center;
      `}
    >
      <button
        aria-expanded={expanded}
        // @ts-expect-error: popper is supposed to be used this way, see the documentation
        ref={setReferenceElement}
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
        <div
          // eslint-disable-next-line react/forbid-dom-props
          style={styles.popper}
          {...attributes.popper}
          className={css`
            z-index: 200;
          `}
          // @ts-expect-error: popper is supposed to be used this way, see the documentation
          ref={setPopperElement}
        >
          <ul
            className={css`
              box-shadow: 0px 8px 40px rgba(0, 0, 0, 0.1);
              width: fit-content;
              list-style: none;
              padding: 0;
              border-radius: 4px;
              margin: 0;
              font-size: 17px;

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
        </div>
      )}
    </div>
  )
}

export default DropdownMenu

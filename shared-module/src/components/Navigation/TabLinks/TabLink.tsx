import { css } from "@emotion/css"
import { UseQueryResult } from "@tanstack/react-query"
import Link from "next/link"
import { useRouter } from "next/router"
import { UrlObject } from "node:url"
import React from "react"

import useQueryParameter from "../../../hooks/useQueryParameter"
import { baseTheme, theme } from "../../../styles"
import { respondToOrLarger } from "../../../styles/respond"
import Spinner from "../../Spinner"

export interface TabLinkProps {
  url: string | UrlObject
  isActive: boolean
  countHook?: () => UseQueryResult<number, unknown>
}

const TabLink: React.FC<React.PropsWithChildren<React.PropsWithChildren<TabLinkProps>>> = ({
  children,
  url,
  isActive,
  countHook,
}) => {
  const count = countHook?.()
  const path = `${useQueryParameter("path")}`
  const router = useRouter()

  if (count?.isError) {
    // eslint-disable-next-line i18next/no-literal-string
    console.error(`Could not fetch count for ${path}:\n`, count.error)
  }

  const urlObject =
    typeof url === "string"
      ? {
          // Ensure that router.route has the [...path] defined, this way it won't become a query parameter in any case.
          // eslint-disable-next-line i18next/no-literal-string
          pathname: path ? router.route : `${router.route}/[...path]`,
          // Support for subpaths with splitting to an array.
          query: { ...router.query, path: url.split("/") },
        }
      : url
  return (
    <Link href={urlObject} passHref replace>
      <a
        href="replace"
        role="tab"
        tabIndex={isActive ? 0 : -1}
        aria-selected={isActive}
        className={css`
          flex-grow: 1;
          color: ${theme.secondary.text};
          text-align: center;
          text-decoration: none;
          background: ${isActive ? theme.secondary.activeBg : "inherit"};
          border-radius: 0.2rem;
          padding: 0.75rem 0.35rem;
          ${respondToOrLarger.sm} {
            padding: 0.75rem 0;
          }
          :focus {
            background: ${theme.secondary.focusBg};
          }
          :hover {
            background: ${theme.secondary.hoverBg};
            color: ${theme.secondary.hoverText};
          }
        `}
      >
        <span>{children}</span> {count?.isLoading && <Spinner variant="small" disableMargin />}
        {count?.isSuccess && count.data !== 0 && (
          <span
            className={css`
              background: ${baseTheme.colors.red[400]};
              border-radius: 20px;
              line-height: 10px;
              padding: 1px 5px;
              text-align: center;
              font-size: 14px;
              color: ${baseTheme.colors.primary[100]};
              margin-left: 3px;
              width: 20px;
              height: 20px;
            `}
          >
            {count?.data}
          </span>
        )}
      </a>
    </Link>
  )
}

export default TabLink

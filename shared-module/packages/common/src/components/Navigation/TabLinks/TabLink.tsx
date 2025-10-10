import { css } from "@emotion/css"
import { UseQueryResult } from "@tanstack/react-query"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
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

const TabLink: React.FC<React.PropsWithChildren<TabLinkProps>> = ({
  children,
  url,
  isActive,
  countHook,
}) => {
  const count = countHook?.()
  const path = `${useQueryParameter("path")}`
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  if (count?.isError) {
    console.error(`Could not fetch count for ${path}:\n`, count.error)
  }

  const urlObject =
    typeof url === "string"
      ? {
          // Ensure that pathname has the [...path] defined, this way it won't become a query parameter in any case.
          // eslint-disable-next-line i18next/no-literal-string
          pathname: path ? pathname : `${pathname}/[...path]`,
          // Support for subpaths with splitting to an array.
          query: { path: url ? url.split("/") : [] },
        }
      : url
  return (
    <Link
      href={urlObject}
      replace
      role="tab"
      tabIndex={isActive ? 0 : -1}
      aria-selected={isActive}
      className={css`
        flex-grow: 1;
        color: ${theme.secondary.text};
        text-align: center;
        text-decoration: none;
        background: ${isActive ? theme.secondary.activeBg : "inherit"};
        box-shadow: ${isActive
          ? "rgba(17, 17, 26, 0.1) 0px 4px 16px, rgba(17, 17, 26, 0.05) 0px 8px 32px"
          : "none"};
        border-radius: 0.3rem;
        padding: 0.75rem 0.35rem;
        ${respondToOrLarger.sm} {
          padding: 0.75rem 0;
        }
        :focus {
          background: ${theme.secondary.focusBg};
          box-shadow:
            rgba(17, 17, 26, 0.1) 0px 4px 16px,
            rgba(17, 17, 26, 0.05) 0px 8px 32px;
        }
        :hover {
          background: ${isActive ? theme.secondary.activeBg : theme.secondary.hoverBg};
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
    </Link>
  )
}

export default TabLink

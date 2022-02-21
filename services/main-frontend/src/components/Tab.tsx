import { css } from "@emotion/css"
import Link from "next/link"
import { useRouter } from "next/router"
import { UrlObject } from "node:url"
import React from "react"
import { UseQueryResult } from "react-query"

import Spinner from "../shared-module/components/Spinner"
import useQueryParameter from "../shared-module/hooks/useQueryParameter"

export interface TabProps {
  url: string | UrlObject
  isActive: boolean
  countHook?: () => UseQueryResult<number, unknown>
}

const Tab: React.FC<TabProps> = ({ children, url, isActive, countHook }) => {
  const count = countHook?.()
  const path = `${useQueryParameter("path")}`
  const router = useRouter()

  const urlObject =
    typeof url === "string"
      ? {
          // Ensure that router.route has the [...path] defined
          // eslint-disable-next-line i18next/no-literal-string
          pathname: path ? router.route : `${router.route}/[...path]`,
          query: { ...router.query, path: url.split("/") },
        }
      : url
  return (
    <Link href={urlObject} passHref replace>
      <a
        href="replace"
        role="tab"
        aria-controls="panel"
        tabIndex={isActive ? 0 : -1}
        aria-selected={isActive}
        className={css`
          margin-right: 1rem;
        `}
      >
        {children} {count?.isLoading && <Spinner variant="small" />}
        {count?.isSuccess && <span>{count?.data}</span>}
      </a>
    </Link>
  )
}

export default Tab

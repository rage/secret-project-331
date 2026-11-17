"use client"

import { useAtom } from "jotai"
import React from "react"

import { ErrorNoticeTitleContext } from "@/shared-module/components/components/ErrorNotice"

import { pageErrorTitleAtom } from "../hooks/pageTitleAtoms"
import { usePageTitle } from "../hooks/usePageTitle"

/** Above any page's own title, so a page-level error names the page while it is shown. */
const ERROR_TITLE_ORDER = 1000

/** Puts page-level `ErrorNotice`s in the document title; mount once inside the jotai Provider. */
const ErrorNoticeTitleProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [title, setTitle] = useAtom(pageErrorTitleAtom)
  // oxlint-disable-next-line i18next/no-literal-string -- registry key, not user copy
  usePageTitle(title, { key: "error-notice", order: ERROR_TITLE_ORDER })
  return (
    <ErrorNoticeTitleContext.Provider value={setTitle}>{children}</ErrorNoticeTitleContext.Provider>
  )
}

export default ErrorNoticeTitleProvider

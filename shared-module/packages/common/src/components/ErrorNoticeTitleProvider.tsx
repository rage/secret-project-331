"use client"

import { useSetAtom } from "jotai"
import React, { useEffect, useState } from "react"

import { ErrorNoticeTitleContext } from "@/shared-module/components/components/ErrorNotice"

import { pageErrorShownAtom } from "../hooks/pageTitleAtoms"
import { usePageTitle } from "../hooks/usePageTitle"

/** Above any page's own title, so a page-level error names the page while it is shown. */
const ERROR_TITLE_ORDER = 1000

/**
 * Wires page-level `ErrorNotice`s (`headingLevel={1}`) to the document title. Mount once, inside
 * the jotai `<Provider>` and around the page content.
 */
const ErrorNoticeTitleProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [title, setTitle] = useState<string | null>(null)
  // oxlint-disable-next-line i18next/no-literal-string -- registry key, not user copy
  usePageTitle(title, { key: "error-notice", order: ERROR_TITLE_ORDER })
  const setPageErrorShown = useSetAtom(pageErrorShownAtom)
  useEffect(() => {
    setPageErrorShown(title !== null)
    return () => setPageErrorShown(false)
  }, [title, setPageErrorShown])
  return (
    <ErrorNoticeTitleContext.Provider value={setTitle}>{children}</ErrorNoticeTitleContext.Provider>
  )
}

export default ErrorNoticeTitleProvider

"use client"

import Head from "next/head"
import React from "react"

import { DEFAULT_SITE_NAME, formatPageTitle } from "@/shared-module/common/utils/pageTitle"

interface CmsPageTitleProps {
  /** Already-composed, localized descriptor, e.g. "Edit: Chapter 1 - Programming 101". */
  title: string | null | undefined
}

/**
 * Sets the CMS document title to `"{title} - {site name}"` via next/head, overriding the bare
 * site name that the app Layout renders by default (next/head keeps the last <title>). Renders
 * nothing visible. Use `joinTitleSegments` to build the descriptor before passing it in.
 */
const CmsPageTitle: React.FC<CmsPageTitleProps> = ({ title }) => (
  <Head>
    <title>{formatPageTitle(title, DEFAULT_SITE_NAME)}</title>
  </Head>
)

export default CmsPageTitle

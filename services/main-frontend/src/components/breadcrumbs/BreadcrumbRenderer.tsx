"use client"

import { css } from "@emotion/css"
import { useAtomValue } from "jotai"

import BreakFromCentered from "@/shared-module/common/components/Centering/BreakFromCentered"
import { omitUndefined } from "@/shared-module/common/utils/nullability"
import { Breadcrumbs, type BreadcrumbItem } from "@/shared-module/components"

import { breadcrumbCrumbsAtom } from "./breadcrumbAtoms"
import { breadcrumbBarCss } from "./breadcrumbBarCss"

/**
 * The registered breadcrumbs, full width under the top bar. Pass `inPage` to render them inside a
 * page's own container instead, lined up with its content.
 */
export default function BreadcrumbRenderer({ inPage = false }: { inPage?: boolean }) {
  const registeredCrumbs = useAtomValue(breadcrumbCrumbsAtom)

  if (registeredCrumbs.length === 0) {
    return null
  }

  const items: BreadcrumbItem[] = registeredCrumbs.map(({ entryKey, index, crumb }) => {
    const key = `${entryKey}-${index}`
    return crumb.isLoading
      ? // oxlint-disable-next-line i18next/no-literal-string -- discriminant tag, not user-visible text
        { status: "pending", key }
      : omitUndefined({ key, label: crumb.label, href: crumb.href })
  })

  return inPage ? (
    <Breadcrumbs items={items} className={inPageCss} />
  ) : (
    <BreakFromCentered sidebar={false}>
      <Breadcrumbs items={items} className={breadcrumbBarCss} />
    </BreakFromCentered>
  )
}

const inPageCss = css`
  padding-top: 1rem;
`

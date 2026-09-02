"use client"

import { css } from "@emotion/css"
import { useAtomValue } from "jotai"

import BreakFromCentered from "@/shared-module/common/components/Centering/BreakFromCentered"
import { omitUndefined } from "@/shared-module/common/utils/nullability"
import { Breadcrumbs, type BreadcrumbItem } from "@/shared-module/components"

import { breadcrumbCrumbsAtom } from "./breadcrumbAtoms"

/** Renders the trail accumulated by `useRegisterBreadcrumbs` across the active layouts. */
export default function BreadcrumbRenderer() {
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

  return (
    <BreakFromCentered sidebar={false}>
      <Breadcrumbs items={items} className={wrapper} />
    </BreakFromCentered>
  )
}

const wrapper = css`
  padding: 1rem 2rem;

  &:nth-of-type(n + 2) {
    margin-top: 2.5rem;
  }
`

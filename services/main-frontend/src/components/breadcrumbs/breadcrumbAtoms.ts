"use client"

import { atom } from "jotai"

export type LoadingCrumb = { isLoading: true }
export type LoadedCrumb = { isLoading: false; label: string; href?: string }
export type Crumb = LoadingCrumb | LoadedCrumb
export type BreadcrumbEntry = { key: string; order: number; crumbs: Crumb[] }

export const breadcrumbEntriesAtom = atom<Record<string, BreadcrumbEntry>>({})

export const sortedBreadcrumbEntriesAtom = atom((get) =>
  Object.values(get(breadcrumbEntriesAtom)).sort((a, b) => a.order - b.order),
)

export type BreadcrumbItemWithKey = { entryKey: string; index: number; crumb: Crumb }

export const breadcrumbCrumbsAtom = atom((get) => {
  const entries = get(sortedBreadcrumbEntriesAtom)
  return entries.flatMap((e) =>
    e.crumbs.map((crumb, index): BreadcrumbItemWithKey => ({ entryKey: e.key, index, crumb })),
  )
})

export const isCourseMaterialAtom = atom<boolean>(false)

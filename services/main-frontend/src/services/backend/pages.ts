import { queryOptions } from "@tanstack/react-query"

import {
  getCoursePagesOptions as getCoursePagesGeneratedOptions,
  getPageHistoryCountOptions as getPageHistoryCountGeneratedOptions,
  getPageHistoryOptions as getPageHistoryGeneratedOptions,
  getPageInfoOptions as getPageInfoGeneratedOptions,
} from "@/generated/api/@tanstack/react-query.generated"
import {
  getCoursePages as getCoursePagesFromApi,
  getPageHistoryCount as getPageHistoryCountFromApi,
  getPageHistory as getPageHistoryFromApi,
  getPageInfo as getPageInfoFromApi,
} from "@/generated/api/sdk.generated"
import type {
  Page as GeneratedPage,
  PageHistory as GeneratedPageHistory,
  PageInfo as GeneratedPageInfo,
} from "@/generated/api/types.generated"
import { Page, PageHistory, PageInfo } from "@/shared-module/common/bindings"

const normalizePage = (page: GeneratedPage): Page => ({
  ...page,
  chapter_id: page.chapter_id ?? null,
  copied_from: page.copied_from ?? null,
  course_id: page.course_id ?? null,
  deleted_at: page.deleted_at ?? null,
  exam_id: page.exam_id ?? null,
  page_language_group_id: page.page_language_group_id ?? null,
})

const normalizePageHistory = (pageHistory: GeneratedPageHistory): PageHistory => ({
  ...pageHistory,
  restored_from_id: pageHistory.restored_from_id ?? null,
})

const normalizePageInfo = (pageInfo: GeneratedPageInfo): PageInfo => ({
  ...pageInfo,
  course_id: pageInfo.course_id ?? null,
  course_name: pageInfo.course_name ?? null,
  course_slug: pageInfo.course_slug ?? null,
  organization_slug: pageInfo.organization_slug ?? null,
})

export const fetchPageInfo = async (pageId: string): Promise<PageInfo> => {
  const pageInfo = await getPageInfoFromApi({
    path: {
      page_id: pageId,
    },
    throwOnError: true,
  })

  return normalizePageInfo(pageInfo)
}

export const getPageInfoOptions = (pageId: string) =>
  queryOptions({
    ...getPageInfoGeneratedOptions({
      path: {
        page_id: pageId,
      },
    }),
    select: (pageInfo): PageInfo => normalizePageInfo(pageInfo),
  })

export const fetchHistoryForPage = async (
  pageId: string,
  page: number,
  limit: number,
): Promise<PageHistory[]> => {
  const history = await getPageHistoryFromApi({
    path: {
      page_id: pageId,
    },
    query: {
      page,
      limit,
    },
    throwOnError: true,
  })

  return history.map(normalizePageHistory)
}

export const getPageHistoryOptions = (pageId: string, page: number, limit: number) =>
  queryOptions({
    ...getPageHistoryGeneratedOptions({
      path: {
        page_id: pageId,
      },
      query: {
        page,
        limit,
      },
    }),
    select: (history): PageHistory[] => history.map(normalizePageHistory),
  })

export const fetchHistoryCountForPage = async (pageId: string): Promise<number> => {
  return await getPageHistoryCountFromApi({
    path: {
      page_id: pageId,
    },
    throwOnError: true,
  })
}

export const getPageHistoryCountOptions = (pageId: string) =>
  queryOptions({
    ...getPageHistoryCountGeneratedOptions({
      path: {
        page_id: pageId,
      },
    }),
  })

export const fetchAllPagesByCourseId = async (courseId: string): Promise<Page[]> => {
  const pages = await getCoursePagesFromApi({
    path: {
      course_id: courseId,
    },
    throwOnError: true,
  })

  return pages.map(normalizePage)
}

export const getAllPagesByCourseIdOptions = (courseId: string) =>
  queryOptions({
    ...getCoursePagesGeneratedOptions({
      path: {
        course_id: courseId,
      },
    }),
    select: (pages): Page[] => pages.map(normalizePage),
  })

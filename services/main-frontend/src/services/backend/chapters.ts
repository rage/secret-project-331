import { queryOptions } from "@tanstack/react-query"

import { getCourseChaptersOptions as getCourseChaptersGeneratedOptions } from "@/generated/api/@tanstack/react-query.generated"
import {
  deleteChapterImage as deleteChapterImageFromApi,
  getCourseChapters as getCourseChaptersFromApi,
  updateChapterImage as updateChapterImageFromApi,
} from "@/generated/api/sdk.generated"
import type {
  Chapter as GeneratedChapter,
  DatabaseChapter as GeneratedDatabaseChapter,
} from "@/generated/api/types.generated"
import { Chapter, DatabaseChapter } from "@/shared-module/common/bindings"
import { validateFile } from "@/shared-module/common/utils/files"

const normalizeChapter = (chapter: GeneratedChapter): Chapter => ({
  ...chapter,
  chapter_image_url: chapter.chapter_image_url ?? null,
  color: chapter.color ?? null,
  copied_from: chapter.copied_from ?? null,
  deadline: chapter.deadline ?? null,
  deleted_at: chapter.deleted_at ?? null,
  front_page_id: chapter.front_page_id ?? null,
  opens_at: chapter.opens_at ?? null,
})

const normalizeDatabaseChapter = (chapter: GeneratedDatabaseChapter): DatabaseChapter => ({
  ...chapter,
  chapter_image_path: chapter.chapter_image_path ?? null,
  color: chapter.color ?? null,
  copied_from: chapter.copied_from ?? null,
  deadline: chapter.deadline ?? null,
  deleted_at: chapter.deleted_at ?? null,
  front_page_id: chapter.front_page_id ?? null,
  opens_at: chapter.opens_at ?? null,
})

export const setChapterImage = async (chapterId: string, file: File): Promise<Chapter> => {
  validateFile(file, ["image"])
  const chapter = await updateChapterImageFromApi({
    path: {
      chapter_id: chapterId,
    },
    body: {
      file: file as unknown as number[],
    },
    throwOnError: true,
  })

  return normalizeChapter(chapter)
}

export const removeChapterImage = async (chapterId: string): Promise<void> => {
  await deleteChapterImageFromApi({
    path: {
      chapter_id: chapterId,
    },
    throwOnError: true,
  })
}

export const fetchAllChaptersByCourseId = async (courseId: string): Promise<DatabaseChapter[]> => {
  const chapters = await getCourseChaptersFromApi({
    path: {
      course_id: courseId,
    },
    throwOnError: true,
  })

  return chapters.map(normalizeDatabaseChapter)
}

export const getAllChaptersByCourseIdOptions = (courseId: string) =>
  queryOptions({
    ...getCourseChaptersGeneratedOptions({
      path: {
        course_id: courseId,
      },
    }),
    select: (chapters): DatabaseChapter[] => chapters.map(normalizeDatabaseChapter),
  })

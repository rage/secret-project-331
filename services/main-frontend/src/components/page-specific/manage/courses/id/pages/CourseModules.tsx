import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"
import { v4 } from "uuid"

import { submitChanges as submitModuleChanges } from "../../../../../../services/backend/course-modules"
import { fetchCourseStructure } from "../../../../../../services/backend/courses"
import { ModifiedModule, NewModule } from "../../../../../../shared-module/bindings"
import ErrorBanner from "../../../../../../shared-module/components/ErrorBanner"
import Spinner from "../../../../../../shared-module/components/Spinner"
import useToastMutation from "../../../../../../shared-module/hooks/useToastMutation"
import { baseTheme } from "../../../../../../shared-module/styles"
import { respondToOrLarger } from "../../../../../../shared-module/styles/respond"
import BottomPanel from "../../../../../BottomPanel"

import EditCourseModuleForm from "./EditCourseModuleForm"
import NewCourseModuleForm, { Fields } from "./NewCourseModuleForm"

interface Props {
  courseId: string
}

export type ModuleView = {
  id: string
  name: string | null
  order_number: number
  firstChapter: number | null
  lastChapter: number | null
  isNew: boolean
  ects_credits: number | null
  uh_course_code: string | null
  automatic_completion: boolean
  automatic_completion_number_of_points_treshold: number | null
  automatic_completion_number_of_exercises_attempted_treshold: number | null
}

type ChapterView = { id: string; name: string; module: string | null; chapter_number: number }

type ModuleList = {
  modules: Array<ModuleView>
  chapters: Array<ChapterView>
  error: string | null
}

const CourseModules: React.FC<Props> = ({ courseId }) => {
  const { t } = useTranslation()

  const [chapterNumbers, setChapterNumbers] = useState([1])

  // module list state
  const [initialModuleList, setInitialModuleList] = useState<ModuleList>({
    modules: [],
    chapters: [],
    error: null,
  })
  const [{ modules, chapters, error }, setModuleList] = useState<ModuleList>({
    modules: [],
    chapters: [],
    error: null,
  })

  // submitting state
  const [edited, setEdited] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // helper functions
  const validateModuleList = (
    modules: Array<ModuleView>,
    chapters: Array<ChapterView>,
  ): string | null => {
    const seenModules = new Map<string, number>()

    // check that the chapters are continuous to disallow configurations such as:
    // module 1: [chapter 1, chapter 3], module 2: [chapter 2]
    // also checks that all chapters belong to some module
    chapters.sort((l, r) => l.chapter_number - r.chapter_number)
    let currentModule: string | null = null
    for (const chapter of chapters) {
      if (chapter.module !== null) {
        if (chapter.module !== currentModule) {
          currentModule = chapter.module
          // should be unseen module
          const prevChapter = seenModules.get(chapter.module)
          if (prevChapter !== undefined) {
            const erroringModule = modules.find((m) => m.id === currentModule)
            if (erroringModule?.name === null) {
              return t("error-modules-default-noncontinuous-chapters", {
                prevChapter,
                currChapter: chapter.chapter_number,
              })
            } else {
              return t("error-modules-noncontinuous-chapters", {
                moduleName: erroringModule?.name ?? "",
                prevChapter,
                currChapter: chapter.chapter_number,
              })
            }
          }
        }
        seenModules.set(chapter.module, chapter.chapter_number)
      } else {
        return t("error-modules-chapter-not-in-module", {
          chapterNumber: chapter.chapter_number,
          chapterName: chapter.name,
        })
      }
    }

    // check that no module is empty
    for (const module of modules) {
      if (!seenModules.has(module.id)) {
        return t("error-modules-empty-module", { moduleName: module.name })
      }
    }

    // all ok
    return null
  }
  const firstAndLastChaptersOfModule = (
    moduleId: string,
    chapters: Array<ChapterView>,
  ): [number | null, number | null] => {
    let first = null
    let last = null

    for (const chapter of chapters) {
      if (chapter.module === moduleId) {
        if (first === null || first > chapter.chapter_number) {
          first = chapter.chapter_number
        }
        if (last === null || last < chapter.chapter_number) {
          last = chapter.chapter_number
        }
      }
    }

    return [first, last]
  }
  const sortAndUpdateOrderNumbers = (modules: Array<ModuleView>): Array<ModuleView> => {
    modules.sort((l, r) => {
      // sort default module first
      if (l.name === null) {
        return -1
      } else if (r.name === null) {
        1
      }
      // sort according to first chapters, empty modules last
      return (l.firstChapter ?? Infinity) - (r.firstChapter ?? 0)
    })

    // update order numbers
    let order = 0
    modules.forEach((m) => {
      m.order_number = order
      order += 1
    })
    return modules
  }

  // queries and mutations
  const courseStructureQuery = useQuery(
    ["course-structure", courseId],
    () => fetchCourseStructure(courseId),
    {
      onSuccess: (courseStructure) => {
        const chapterNumbers = courseStructure.chapters
          .sort((l, r) => l.chapter_number - r.chapter_number)
          .map((c) => c.chapter_number)
        setChapterNumbers(chapterNumbers)

        const makeModuleList = () => {
          const chapters = courseStructure.chapters
            .sort((l, r) => l.chapter_number - r.chapter_number)
            .map((c) => {
              return {
                id: c.id,
                name: c.name,
                module: c.course_module_id,
                chapter_number: c.chapter_number,
              }
            })
          const modules = courseStructure.modules.map((m) => {
            const [firstChapter, lastChapter] = firstAndLastChaptersOfModule(m.id, chapters)
            return {
              id: m.id,
              name: m.name,
              order_number: m.order_number,
              firstChapter,
              lastChapter,
              isNew: false,
              uh_course_code: m.uh_course_code,
              ects_credits: m.ects_credits,
              automatic_completion: m.automatic_completion,
              automatic_completion_number_of_points_treshold:
                m.automatic_completion_number_of_points_treshold,
              automatic_completion_number_of_exercises_attempted_treshold:
                m.automatic_completion_number_of_exercises_attempted_treshold,
            }
          })
          const error = validateModuleList(modules, chapters)
          return { modules, chapters, error }
        }
        setInitialModuleList(makeModuleList())
        setModuleList(makeModuleList())
      },
    },
  )
  const moduleUpdatesMutation = useToastMutation(
    () => {
      console.log(modules)
      console.log(initialModuleList.modules)
      setSubmitting(true)

      // check new and modified modules
      const newModules = new Map<string, NewModule>()
      const modifiedModules = new Array<ModifiedModule>()
      const idToInitialModule = initialModuleList.modules.reduce<Map<string, ModuleView>>(
        (map, module) => map.set(module.id, module),
        new Map(),
      )
      for (const module of modules) {
        if (module.name !== null) {
          // cannot add or modify default module
          const initialModule = idToInitialModule.get(module.id)
          if (initialModule === undefined) {
            // new module
            newModules.set(module.id, {
              name: module.name,
              order_number: module.order_number,
              chapters: chapters.filter((c) => c.module === module.id).map((c) => c.id),
              uh_course_code: module.uh_course_code,
              ects_credits: module.ects_credits,
              automatic_completion: module.automatic_completion,
              automatic_completion_number_of_points_treshold:
                module.automatic_completion_number_of_points_treshold,
              automatic_completion_number_of_exercises_attempted_treshold:
                module.automatic_completion_number_of_exercises_attempted_treshold,
            })
          } else {
            // old module, check for modifications
            if (
              module.name !== initialModule.name ||
              module.uh_course_code !== initialModule.uh_course_code ||
              module.ects_credits !== initialModule.ects_credits ||
              module.automatic_completion !== initialModule.automatic_completion ||
              module.automatic_completion_number_of_points_treshold !==
                initialModule.automatic_completion_number_of_points_treshold ||
              module.ects_credits !== initialModule.ects_credits ||
              module.automatic_completion_number_of_exercises_attempted_treshold !==
                initialModule.automatic_completion_number_of_exercises_attempted_treshold
            ) {
              modifiedModules.push({
                id: module.id,
                name: module.name !== initialModule.name ? module.name : null,
                order_number: module.order_number,
                uh_course_code: module.uh_course_code,
                ects_credits: module.ects_credits ?? null,
                automatic_completion: module.automatic_completion ?? false,
                automatic_completion_number_of_points_treshold:
                  module.automatic_completion_number_of_points_treshold ?? null,
                automatic_completion_number_of_exercises_attempted_treshold:
                  module.automatic_completion_number_of_exercises_attempted_treshold ?? null,
              })
            }
          }
        }
      }

      // check deleted modules
      const deletedModules = new Array<string>()
      const idToUpdatedModule = modules.reduce<Map<string, ModuleView>>(
        (map, module) => map.set(module.id, module),
        new Map(),
      )
      for (const module of initialModuleList.modules) {
        if (!idToUpdatedModule.has(module.id)) {
          deletedModules.push(module.id)
        }
      }

      // check moved chapters
      const movedChapters = new Array<[string, string]>()
      const idToInitialChapter = initialModuleList.chapters.reduce<Map<string, ChapterView>>(
        (map, chapter) => map.set(chapter.id, chapter),
        new Map(),
      )
      for (const chapter of chapters) {
        const initialChapter = idToInitialChapter.get(chapter.id)
        if (
          initialChapter !== undefined &&
          chapter.module !== null &&
          // chapters moved to a new module are handled as part of creating the new module
          !newModules.has(chapter.module) &&
          initialChapter.module !== chapter.module
        ) {
          movedChapters.push([chapter.id, chapter.module])
        }
      }

      return submitModuleChanges(
        courseId,
        Array.from(newModules.values()),
        deletedModules,
        modifiedModules,
        movedChapters,
      )
    },
    { notify: true, method: "POST" },
    {
      onSuccess: () => {
        setEdited(false)
        courseStructureQuery.refetch()
      },
      onSettled: () => {
        setSubmitting(false)
      },
    },
  )

  // handler functions
  const handleSaveModuleEdits = (
    id: string,
    {
      name,
      starts,
      ends,
      ects_credits,
      uh_course_code,
      automatic_completion,
      automatic_completion_number_of_points_treshold,
      automatic_completion_number_of_exercises_attempted_treshold,
    }: {
      name: string | null
      starts: number
      ends: number
      ects_credits: number | null
      uh_course_code: string | null
      automatic_completion: boolean
      automatic_completion_number_of_points_treshold: number | null
      automatic_completion_number_of_exercises_attempted_treshold: number | null
    },
  ) => {
    setModuleList((old) => {
      const chapters = [...old.chapters]
      chapters.forEach((c) => {
        if (starts <= c.chapter_number && c.chapter_number <= ends) {
          c.module = id
        } else if (c.module === id) {
          c.module = null
        }
      })
      const modules = [...old.modules]
      modules.forEach((m) => {
        if (m.id === id) {
          return (
            (m.name = name),
            (m.ects_credits = ects_credits),
            (m.uh_course_code = uh_course_code),
            (m.automatic_completion = automatic_completion),
            (m.automatic_completion_number_of_points_treshold =
              automatic_completion_number_of_points_treshold),
            (m.automatic_completion_number_of_exercises_attempted_treshold =
              automatic_completion_number_of_exercises_attempted_treshold)
          )
        }
        const [first, last] = firstAndLastChaptersOfModule(m.id, chapters)
        m.firstChapter = first
        m.lastChapter = last
      })
      return {
        modules: sortAndUpdateOrderNumbers(modules),
        chapters,
        error: validateModuleList(modules, chapters),
      }
    })
  }
  const handleDeleteModule = (moduleId: string) => {
    setEdited(true)
    setModuleList((old) => {
      const modules = old.modules.filter((m) => m.id !== moduleId)
      const chapters = [...old.chapters].map((c) => {
        const updated = { ...c }
        if (updated.module === moduleId) {
          updated.module = null
        }
        return updated
      })
      return {
        modules: sortAndUpdateOrderNumbers(modules),
        chapters,
        error: validateModuleList(modules, chapters),
      }
    })
  }
  const handleSubmit = () => moduleUpdatesMutation.mutate()
  const handleReset = () => {
    setEdited(false)
    setModuleList(initialModuleList)
  }

  const onSaveNewModule = ({
    name,
    starts,
    ends,
    ects_credits,
    uh_course_code,
    automatic_completion,
    automatic_completion_number_of_points_treshold,
    automatic_completion_number_of_exercises_attempted_treshold,
  }: Fields) => {
    setEdited(true)
    const newModuleId = v4()

    setModuleList((old) => {
      // update chapters
      const chapters = [...old.chapters]
      chapters.forEach((c) => {
        if (starts <= c.chapter_number && c.chapter_number <= ends) {
          c.module = newModuleId
        }
      })

      // update modules
      const modules = [
        ...old.modules,
        {
          id: newModuleId,
          name,
          order_number: 1,
          firstChapter: 1,
          lastChapter: 1,
          isNew: true,
          uh_course_code,
          ects_credits,
          automatic_completion,
          automatic_completion_number_of_points_treshold,
          automatic_completion_number_of_exercises_attempted_treshold,
        },
      ]
      modules.forEach((m) => {
        const [first, last] = firstAndLastChaptersOfModule(m.id, chapters)
        m.firstChapter = first
        m.lastChapter = last
      })

      return {
        modules: sortAndUpdateOrderNumbers(modules),
        chapters,
        error: validateModuleList(modules, chapters),
      }
    })
  }

  if (courseStructureQuery.isError) {
    return <ErrorBanner variant={"link"} error={courseStructureQuery.error} />
  } else if (courseStructureQuery.isLoading) {
    return <Spinner variant={"medium"} />
  }
  return (
    <>
      <div
        className={css`
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
        `}
      >
        <h1
          className={css`
            margin-bottom: 2rem;
            font-weight: 600;
            font-size: 40px;
          `}
        >
          {t("modules")}
        </h1>
        <NewCourseModuleForm chapters={chapterNumbers} onSubmitForm={onSaveNewModule} />
        {modules
          .sort((l, r) => {
            return l.order_number - r.order_number
          })
          .map((module) => (
            <div
              className={css`
                margin-bottom: 2rem;
                width: 100%;
                ${respondToOrLarger.sm} {
                  width: 80%;
                }
              `}
              key={module.id}
            >
              <EditCourseModuleForm
                module={module}
                chapters={chapterNumbers}
                onSubmitForm={handleSaveModuleEdits}
                onDeleteModule={handleDeleteModule}
              />
              {chapters
                .filter((c) => c.module === module.id)
                .map((c) => (
                  <div
                    className={css`
                      background-color: ${baseTheme.colors.green[100]};
                      color: ${baseTheme.colors.green[700]};
                      height: 3.5rem;
                      margin-top: 0.25rem;
                      margin-bottom: 0.25rem;
                      min-width: 80%;
                      display: flex;
                      align-items: center;
                      font-weight: 600;
                    `}
                    key={c.id}
                  >
                    <div
                      className={css`
                        margin-left: 2rem;
                      `}
                    >
                      {c.chapter_number}: {c.name}
                    </div>
                  </div>
                ))}
            </div>
          ))}
      </div>
      <BottomPanel
        title={t("title-dialog-module-save")}
        error={error}
        show={edited}
        leftButtonText={t("save-changes")}
        leftButtonDisabled={error !== null || submitting}
        onClickLeft={handleSubmit}
        rightButtonText={t("button-reset")}
        onClickRight={handleReset}
        rightButtonDisabled={submitting}
      />
    </>
  )
}

export default CourseModules

import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import React, { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { v4 } from "uuid"

import { submitChanges as submitModuleChanges } from "../../../../../../services/backend/course-modules"
import { fetchCourseStructure } from "../../../../../../services/backend/courses"
import BottomPanel from "../../../../../BottomPanel"

import EditCourseModuleForm, { EditCourseModuleFormFields } from "./EditCourseModuleForm"
import NewCourseModuleForm, { Fields } from "./NewCourseModuleForm"

import { CompletionPolicy, ModifiedModule, NewModule } from "@/shared-module/common/bindings"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import Spinner from "@/shared-module/common/components/Spinner"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
import { baseTheme, headingFont } from "@/shared-module/common/styles"
import { respondToOrLarger } from "@/shared-module/common/styles/respond"

const AUTOMATIC = "automatic"
const MANUAL = "manual"

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
  automatic_completion_requires_exam: boolean
  completion_registration_link_override: string | null
  enable_registering_completion_to_uh_open_university: boolean
}

type ChapterView = { id: string; name: string; module: string | null; chapter_number: number }

type ModuleList = {
  modules: Array<ModuleView>
  chapters: Array<ChapterView>
  error: string | null
}

const CourseModules: React.FC<Props> = ({ courseId }) => {
  const { t } = useTranslation()

  const [edited, setEdited] = useState(false)
  const [moduleList, setModuleList] = useState<ModuleList | null>(null)

  // helper functions
  const validateModuleList = (
    modules: Array<ModuleView>,
    chapters: Array<ChapterView>,
  ): string | null => {
    const seenModules = new Map<string, number>()

    chapters.sort((l, r) => l.chapter_number - r.chapter_number)

    // check that the first chapter is in the default module
    if (chapters.length > 0) {
      const firstChapter = chapters[0]
      const firstModule = modules.find((m) => m.id === firstChapter.module)
      if (firstModule !== undefined && firstModule.name !== null) {
        return t("error-modules-first-chapter-not-in-default-module")
      }
    }

    // check that the chapters are continuous to disallow configurations such as:
    // module 1: [chapter 1, chapter 3], module 2: [chapter 2]
    // also checks that all chapters belong to some module
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
    for (const courseModule of modules) {
      if (!seenModules.has(courseModule.id)) {
        return t("error-modules-empty-module", { moduleName: courseModule.name })
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
  const courseStructureQuery = useQuery({
    queryKey: ["course-structure", courseId],
    queryFn: () => fetchCourseStructure(courseId),
    select: (courseStructure) => {
      const chapterNumbers = courseStructure.chapters
        .sort((l, r) => l.chapter_number - r.chapter_number)
        .map((c) => c.chapter_number)

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
        const modules = courseStructure.modules.map<ModuleView>((m) => {
          const [firstChapter, lastChapter] = firstAndLastChaptersOfModule(m.id, chapters)
          if (m.completion_policy.policy === "automatic") {
            return {
              id: m.id,
              name: m.name,
              order_number: m.order_number,
              firstChapter,
              lastChapter,
              isNew: false,
              uh_course_code: m.uh_course_code,
              ects_credits: m.ects_credits,
              automatic_completion: true,
              automatic_completion_number_of_points_treshold:
                m.completion_policy.number_of_points_treshold,
              automatic_completion_number_of_exercises_attempted_treshold:
                m.completion_policy.number_of_exercises_attempted_treshold,
              automatic_completion_requires_exam: m.completion_policy.requires_exam,
              completion_registration_link_override: m.completion_registration_link_override,
              enable_registering_completion_to_uh_open_university:
                m.enable_registering_completion_to_uh_open_university,
            }
          } else {
            return {
              id: m.id,
              name: m.name,
              order_number: m.order_number,
              firstChapter,
              lastChapter,
              isNew: false,
              uh_course_code: m.uh_course_code,
              ects_credits: m.ects_credits,
              automatic_completion: false,
              automatic_completion_number_of_points_treshold: null,
              automatic_completion_number_of_exercises_attempted_treshold: null,
              automatic_completion_requires_exam: false,
              completion_registration_link_override: m.completion_registration_link_override,
              enable_registering_completion_to_uh_open_university:
                m.enable_registering_completion_to_uh_open_university,
            }
          }
        })
        const error = validateModuleList(modules, chapters)
        return { modules, chapters, error }
      }
      return {
        initialModuleList: makeModuleList(),
        moduleList: makeModuleList(),
        chapterNumbers,
      }
    },
  })
  const initialModuleList = courseStructureQuery.data?.initialModuleList
  useEffect(() => {
    if (!courseStructureQuery.data) {
      return
    }
    if (moduleList === null) {
      setModuleList(courseStructureQuery.data.moduleList)
    }
  }, [courseStructureQuery.data, moduleList])

  const moduleUpdatesMutation = useToastMutation(
    () => {
      if (!initialModuleList) {
        throw new Error("initialModuleList is undefined")
      }
      if (!moduleList) {
        throw new Error("moduleList is undefined")
      }

      // check new and modified modules
      const newModules = new Map<string, NewModule>()
      const modifiedModules = new Array<ModifiedModule>()
      const idToInitialModule = initialModuleList.modules.reduce<Map<string, ModuleView>>(
        (map, module) => map.set(module.id, module),
        new Map(),
      )
      for (const courseModule of moduleList.modules) {
        // cannot add or modify default module
        const initialModule = idToInitialModule.get(courseModule.id)
        if (initialModule === undefined && courseModule.name !== null) {
          // new module
          newModules.set(courseModule.id, {
            name: courseModule.name,
            order_number: courseModule.order_number,
            chapters: moduleList.chapters
              .filter((c) => c.module === courseModule.id)
              .map((c) => c.id),
            uh_course_code: courseModule.uh_course_code,
            ects_credits: courseModule.ects_credits,
            completion_policy: mapFieldsToCompletionPolicy(courseModule),
            completion_registration_link_override:
              courseModule.completion_registration_link_override,
            enable_registering_completion_to_uh_open_university:
              courseModule.enable_registering_completion_to_uh_open_university,
          })
        } else if (initialModule !== undefined) {
          // old module, check for modifications
          if (
            courseModule.name !== initialModule.name ||
            courseModule.uh_course_code !== initialModule.uh_course_code ||
            courseModule.ects_credits !== initialModule.ects_credits ||
            courseModule.automatic_completion !== initialModule.automatic_completion ||
            courseModule.automatic_completion_number_of_points_treshold !==
              initialModule.automatic_completion_number_of_points_treshold ||
            courseModule.ects_credits !== initialModule.ects_credits ||
            courseModule.automatic_completion_number_of_exercises_attempted_treshold !==
              initialModule.automatic_completion_number_of_exercises_attempted_treshold ||
            courseModule.automatic_completion_requires_exam !==
              initialModule.automatic_completion_requires_exam ||
            courseModule.completion_registration_link_override !==
              initialModule.completion_registration_link_override ||
            courseModule.enable_registering_completion_to_uh_open_university !==
              initialModule.enable_registering_completion_to_uh_open_university
          ) {
            modifiedModules.push({
              id: courseModule.id,
              name: courseModule.name,
              order_number: courseModule.order_number,
              uh_course_code: courseModule.uh_course_code,
              ects_credits: courseModule.ects_credits,
              completion_policy: mapFieldsToCompletionPolicy(courseModule),
              completion_registration_link_override:
                courseModule.completion_registration_link_override,
              enable_registering_completion_to_uh_open_university:
                courseModule.enable_registering_completion_to_uh_open_university,
            })
          }
        }
      }

      // check deleted modules
      const deletedModules = new Array<string>()
      const idToUpdatedModule = moduleList.modules.reduce<Map<string, ModuleView>>(
        (map, module) => map.set(module.id, module),
        new Map(),
      )
      for (const courseModule of initialModuleList.modules) {
        if (!idToUpdatedModule.has(courseModule.id)) {
          deletedModules.push(courseModule.id)
        }
      }

      // check moved chapters
      const movedChapters = new Array<[string, string]>()
      const idToInitialChapter = initialModuleList.chapters.reduce<Map<string, ChapterView>>(
        (map, chapter) => map.set(chapter.id, chapter),
        new Map(),
      )
      for (const chapter of moduleList.chapters) {
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
      automatic_completion_requires_exam,
      completion_registration_link_override,
      override_completion_link,
      enable_registering_completion_to_uh_open_university,
    }: EditCourseModuleFormFields,
  ) => {
    setEdited(true)
    setModuleList((old) => {
      if (!old) {
        throw new Error("old module list is null")
      }
      const chapters = old.chapters.map((c) => {
        if (starts <= c.chapter_number && c.chapter_number <= ends) {
          return { ...c, module: id }
        } else if (c.module === id) {
          return { ...c, module: null }
        } else {
          return c
        }
      })
      const modules = old.modules.map((m) => {
        if (m.id !== id) {
          return m
        } else {
          const [firstChapter, lastChapter] = firstAndLastChaptersOfModule(m.id, chapters)
          return {
            id,
            name,
            order_number: m.order_number,
            ects_credits,
            uh_course_code,
            automatic_completion,
            automatic_completion_number_of_points_treshold,
            automatic_completion_number_of_exercises_attempted_treshold,
            automatic_completion_requires_exam,
            completion_registration_link_override: override_completion_link
              ? completion_registration_link_override
              : null,
            firstChapter,
            lastChapter,
            isNew: m.isNew,
            enable_registering_completion_to_uh_open_university,
          } satisfies ModuleView
        }
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
      if (!old) {
        throw new Error("old module list is null")
      }
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
    if (!initialModuleList) {
      throw new Error("initialModuleList is undefined")
    }
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
    override_completion_link,
    completion_registration_link_override,
    enable_registering_completion_to_uh_open_university,
  }: Fields) => {
    setEdited(true)
    const newModuleId = v4()

    setModuleList((old) => {
      if (!old) {
        throw new Error("old module list is null")
      }
      // update chapters
      const chapters = [...old.chapters]
      chapters.forEach((c) => {
        if (starts <= c.chapter_number && c.chapter_number <= ends) {
          c.module = newModuleId
        }
      })

      // update modules
      const modules: Array<ModuleView> = [
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
          automatic_completion_requires_exam: false,
          completion_registration_link_override: override_completion_link
            ? completion_registration_link_override
            : null,
          enable_registering_completion_to_uh_open_university,
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
  } else if (courseStructureQuery.isPending) {
    return <Spinner variant={"medium"} />
  }
  return (
    <>
      <div
        className={css`
          display: flex;
          flex-direction: column;
          justify-content: center;
        `}
      >
        <h1
          className={css`
            font-size: clamp(2rem, 3.6vh, 36px);
            color: ${baseTheme.colors.gray[700]};
            font-family: ${headingFont};
            font-weight: bold;
            margin-bottom: 1.6rem;
          `}
        >
          {t("modules")}
        </h1>
        {moduleList?.modules
          .sort((l, r) => {
            return l.order_number - r.order_number
          })
          .map((module) => (
            <div
              className={css`
                margin-bottom: 2rem;
                width: 100%;
              `}
              key={module.id}
            >
              <EditCourseModuleForm
                module={module}
                chapters={courseStructureQuery.data.chapterNumbers}
                onSubmitForm={handleSaveModuleEdits}
                onDeleteModule={handleDeleteModule}
              />
              {moduleList?.chapters
                .filter((c) => c.module === module.id)
                .map((c) => (
                  <div
                    className={css`
                      background-color: #fff;
                      color: ${baseTheme.colors.gray[700]};
                      height: 3.5rem;
                      min-width: 100%;
                      display: flex;
                      align-items: center;
                      font-weight: 500;
                      border-bottom: 2px solid #e1e3e5;
                      border-right: 2px solid #e1e3e5;
                      border-left: 2px solid #e1e3e5;

                      &:last-of-type {
                        border-bottom-right-radius: 4px;
                        border-bottom-left-radius: 4px;
                      }
                    `}
                    key={c.id}
                  >
                    <div
                      className={css`
                        margin-left: 1.25rem;
                      `}
                    >
                      {c.chapter_number}. {c.name}
                    </div>
                  </div>
                ))}
            </div>
          ))}
      </div>
      <BottomPanel
        title={t("title-dialog-module-save")}
        error={moduleList?.error}
        show={edited}
        leftButtonText={t("save-changes")}
        leftButtonDisabled={
          (moduleList?.error !== null && moduleList?.error !== undefined) ||
          moduleUpdatesMutation.isPending
        }
        onClickLeft={handleSubmit}
        rightButtonText={t("button-reset")}
        onClickRight={handleReset}
        rightButtonDisabled={moduleUpdatesMutation.isPending}
      />
      <NewCourseModuleForm
        chapters={courseStructureQuery.data.chapterNumbers}
        onSubmitForm={onSaveNewModule}
      />
    </>
  )
}

export default CourseModules

function mapFieldsToCompletionPolicy(fields: ModuleView): CompletionPolicy {
  if (fields.automatic_completion) {
    return {
      policy: AUTOMATIC,
      course_module_id: fields.id,
      number_of_exercises_attempted_treshold:
        fields.automatic_completion_number_of_exercises_attempted_treshold,
      number_of_points_treshold: fields.automatic_completion_number_of_points_treshold,
      requires_exam: fields.automatic_completion_requires_exam,
    }
  } else {
    return { policy: MANUAL }
  }
}

"use client"

import { useQuery } from "@tanstack/react-query"
import { isEqual } from "lodash"
import React, { useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { v4 } from "uuid"

import BottomPanel from "@/components/BottomPanel"
import { registersCredits } from "@/components/credit-registration/registersCredits"
import {
  dividedListCss,
  pageTitleCss,
  sectionsCss,
  subheadingCss,
  subsectionCss,
} from "@/components/credit-registration/styles"
import { useCanViewCreditRegistrations } from "@/components/credit-registration/teacherCreditRegistrations"
import {
  getCourseCreditRegistrationModuleConfigsOptions,
  getCourseCreditRegistrationSummaryOptions,
  getCourseExercisesOptions,
  getCourseInstancesOptions,
  getCourseStructureOptions,
  getOrganizationCourseExamsOptions,
  getOrganizationExamsOptions,
} from "@/generated/api/@tanstack/react-query.generated"
import {
  setCourseModuleCertificateGeneration,
  updateCourseModules,
} from "@/generated/api/sdk.generated"
import type { ModifiedModule, NewModule } from "@/generated/api/types.generated"
import useCourseBreadcrumbInfoQuery from "@/hooks/useCourseBreadcrumbInfoQuery"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
import { includeIf, omitUndefined } from "@/shared-module/common/utils/nullability"
import {
  manageCourseInstancesRoute,
  manageCourseStudentsRoute,
  organizationFrontPageRoute,
} from "@/shared-module/common/utils/routes"
import { Button, ErrorNotice, QueryResults } from "@/shared-module/components"
import { optionalGeneratedQueryOptions } from "@/utils/optionalGeneratedQueryOptions"
import { viewCourseInstanceCertificatesPageRoute } from "@/utils/routing"

import { MODULE_PARAM, REGISTRATION_PARAM } from "../students/StudentsContext"
import type { CourseModuleFormMode, ExerciseInChapter } from "./CourseModuleForm"
import CourseModuleForm from "./CourseModuleForm"
import type { ModuleCompletionLinks } from "./ModuleCompletionFields"
import type { CourseModuleFormFields } from "./moduleCompletionForm"
import type { ModuleCompletionSettings } from "./moduleCompletionSettings"
import {
  completionPolicyOf,
  linkedExamOf,
  NEW_MODULE_COMPLETION_SETTINGS,
  settingsOfPolicy,
} from "./moduleCompletionSettings"
import ModuleRegistrationStatus from "./ModuleRegistrationStatus"

const STUDENTS_SUBTAB_COMPLETIONS = "completions"
const REGISTRATION_VIEW_FAILED = "failed"

const CREATE: CourseModuleFormMode = "create"
const EDIT: CourseModuleFormMode = "edit"

interface Props {
  courseId: string
}

export interface ModuleView extends ModuleCompletionSettings {
  id: string
  name: string | null
  order_number: number
  firstChapter: number | null
  lastChapter: number | null
  isNew: boolean
}

interface ChapterView {
  id: string
  name: string
  module: string | null
  chapter_number: number
}

interface ModuleList {
  modules: ModuleView[]
  chapters: ChapterView[]
  error: string | null
}

const firstAndLastChaptersOfModule = (
  moduleId: string,
  chapters: ChapterView[],
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

/** The empty module a create card fills in; its id is the one the module is saved under. */
const blankModule = (chapters: number[]): ModuleView => ({
  id: v4(),
  name: "",
  order_number: 0,
  firstChapter: chapters[0] ?? 1,
  lastChapter: chapters.at(-1) ?? 1,
  isNew: true,
  ...NEW_MODULE_COMPLETION_SETTINGS,
})

/** The completions roster, filtered to one module and, when `failed`, to its failed registrations. */
const rosterHrefOf = (courseId: string, moduleId: string, failed?: boolean): string =>
  `${manageCourseStudentsRoute(courseId, STUDENTS_SUBTAB_COMPLETIONS)}?${new URLSearchParams({
    [MODULE_PARAM]: moduleId,
    ...includeIf(failed, { [REGISTRATION_PARAM]: REGISTRATION_VIEW_FAILED }),
  })}`

/** What the save sends. `order_number` is renumbered locally as chapters move and is not an edit of its own. */
const savedFieldsOf = ({ order_number: _orderNumber, ...fields }: ModuleView) => fields

/** What `updateCourseModules` saves; certificates are switched on and off by their own endpoint. */
const updatedFieldsOf = (module: ModuleView) => ({
  name: module.name,
  order_number: module.order_number,
  uh_course_code: module.uh_course_code,
  ects_credits: module.ects_credits,
  completion_policy: completionPolicyOf(module.id, module),
  completion_registration_link_override: module.completion_registration_link_override,
  exam_requirement: module.exam_requirement,
  exam_location_description: module.exam_location_description,
  credit_registration_route: module.credit_registration_route,
})

const sortAndUpdateOrderNumbers = (modules: ModuleView[]): ModuleView[] => {
  modules.sort((l, r) => {
    // sort default module first
    if (l.name === null) {
      return -1
    } else if (r.name === null) {
      return 1
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

const CourseModules: React.FC<Props> = ({ courseId }) => {
  const { t } = useTranslation()

  const [edited, setEdited] = useState(false)
  const [moduleList, setModuleList] = useState<ModuleList | null>(null)
  const [newModule, setNewModule] = useState<ModuleView | null>(null)

  // helper functions
  const validateModuleList = (modules: ModuleView[], chapters: ChapterView[]): string | null => {
    const seenModules = new Map<string, number>()

    chapters.sort((l, r) => l.chapter_number - r.chapter_number)

    // check that the first chapter is in the default module
    const firstChapter = chapters[0]
    if (firstChapter !== undefined) {
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
            // oxlint-disable-next-line no-loop-func -- find runs synchronously; currentModule read immediately
            const erroringModule = modules.find((m) => m.id === currentModule)
            return erroringModule?.name === null
              ? t("error-modules-default-noncontinuous-chapters", {
                  prevChapter,
                  currChapter: chapter.chapter_number,
                })
              : t("error-modules-noncontinuous-chapters", {
                  moduleName: erroringModule?.name ?? "",
                  prevChapter,
                  currChapter: chapter.chapter_number,
                })
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

  // queries and mutations
  const creditRegistrationConfigsQuery = useQuery(
    getCourseCreditRegistrationModuleConfigsOptions({ path: { course_id: courseId } }),
  )
  const creditRegistrationConfigs = creditRegistrationConfigsQuery.data
  // A registration carries the student's Sisu identity, so the counts need their own permission.
  const canViewCreditRegistrations = useCanViewCreditRegistrations(courseId)
  const courseUsesStudyRegistry = (creditRegistrationConfigs ?? []).some((module) =>
    registersCredits(module),
  )
  const registrationSummaryQuery = useQuery({
    ...getCourseCreditRegistrationSummaryOptions({ path: { course_id: courseId } }),
    enabled: canViewCreditRegistrations && courseUsesStudyRegistry,
  })
  const registrationSummaries = registrationSummaryQuery.data?.modules
  const courseStructureQuery = useQuery({
    ...getCourseStructureOptions({
      path: {
        course_id: courseId,
      },
    }),
    select: (courseStructure) => {
      const chapterNumbers = courseStructure.chapters
        .toSorted((l, r) => l.chapter_number - r.chapter_number)
        .map((c) => c.chapter_number)

      const makeModuleList = () => {
        const chapters = courseStructure.chapters
          .toSorted((l, r) => l.chapter_number - r.chapter_number)
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
          return {
            id: m.id,
            name: m.name ?? null,
            order_number: m.order_number,
            firstChapter,
            lastChapter,
            isNew: false,
            ...settingsOfPolicy(m.completion_policy),
            exam_requirement: m.exam_requirement,
            exam_location_description: m.exam_location_description ?? null,
            credit_registration_route: m.credit_registration_route,
            uh_course_code: m.uh_course_code ?? null,
            ects_credits: m.ects_credits ?? null,
            completion_registration_link_override: m.completion_registration_link_override ?? null,
            certification_enabled: m.certification_enabled,
          }
        })
        const error = validateModuleList(modules, chapters)
        return { modules, chapters, error }
      }
      return {
        initialModuleList: makeModuleList(),
        moduleList: makeModuleList(),
        chapterNumbers,
        organizationId: courseStructure.course.organization_id,
        chapterNumberById: new Map(
          courseStructure.chapters.map((c) => [c.id, c.chapter_number] as const),
        ),
      }
    },
  })
  const organizationId = courseStructureQuery.data?.organizationId ?? null
  const chapterNumberById = courseStructureQuery.data?.chapterNumberById
  const exercisesQuery = useQuery(getCourseExercisesOptions({ path: { course_id: courseId } }))
  const exercises = useMemo<ExerciseInChapter[] | null>(() => {
    if (!exercisesQuery.data || !chapterNumberById) {
      return null
    }
    return exercisesQuery.data.flatMap((exercise) => {
      const chapterNumber = exercise.chapter_id
        ? chapterNumberById.get(exercise.chapter_id)
        : undefined
      return chapterNumber === undefined
        ? []
        : [{ chapterNumber, scoreMaximum: exercise.score_maximum }]
    })
  }, [exercisesQuery.data, chapterNumberById])
  // Exams belong to the organization and are linked to courses; both lists are public.
  const organizationExamsQuery = useQuery(
    optionalGeneratedQueryOptions({
      value: organizationId,
      build: (id) => getOrganizationExamsOptions({ path: { organization_id: id } }),
    }),
  )
  const organizationCourseExamsQuery = useQuery(
    optionalGeneratedQueryOptions({
      value: organizationId,
      build: (id) => getOrganizationCourseExamsOptions({ path: { organization_id: id } }),
    }),
  )
  const linkedExams = useMemo(() => {
    const linkedIds = new Set(
      (organizationCourseExamsQuery.data ?? [])
        .filter((courseExam) => courseExam.course_id === courseId)
        .map((courseExam) => courseExam.id),
    )
    return (organizationExamsQuery.data ?? [])
      .filter((exam) => linkedIds.has(exam.id))
      .map((exam) => linkedExamOf(exam))
      .toSorted((l, r) => (l.starts_at ?? "").localeCompare(r.starts_at ?? ""))
  }, [organizationExamsQuery.data, organizationCourseExamsQuery.data, courseId])
  const organizationSlug = useCourseBreadcrumbInfoQuery(courseId).data?.organization_slug
  const courseInstancesQuery = useQuery(
    getCourseInstancesOptions({ path: { course_id: courseId } }),
  )
  const onlyCourseInstance =
    courseInstancesQuery.data?.length === 1 ? courseInstancesQuery.data[0] : undefined
  const links: ModuleCompletionLinks = {
    studentsTab: manageCourseStudentsRoute(courseId, STUDENTS_SUBTAB_COMPLETIONS),
    examsPage: organizationSlug ? organizationFrontPageRoute(organizationSlug) : null,
    // Certificates are set up per course instance.
    certificatesPage: onlyCourseInstance
      ? viewCourseInstanceCertificatesPageRoute(onlyCourseInstance.id)
      : manageCourseInstancesRoute(courseId),
  }
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
    async () => {
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
            ...updatedFieldsOf(courseModule),
            name: courseModule.name,
            chapters: moduleList.chapters
              .filter((c) => c.module === courseModule.id)
              .map((c) => c.id),
          })
        } else if (
          initialModule !== undefined &&
          !isEqual(updatedFieldsOf(courseModule), updatedFieldsOf(initialModule))
        ) {
          modifiedModules.push({ id: courseModule.id, ...updatedFieldsOf(courseModule) })
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

      await updateCourseModules({
        body: {
          new_modules: Array.from(newModules.values()),
          deleted_modules: deletedModules,
          modified_modules: modifiedModules,
          moved_chapters: movedChapters,
        },
        path: {
          course_id: courseId,
        },
      })
      for (const courseModule of moduleList.modules) {
        const initialModule = idToInitialModule.get(courseModule.id)
        if (
          initialModule !== undefined &&
          initialModule.certification_enabled !== courseModule.certification_enabled
        ) {
          await setCourseModuleCertificateGeneration({
            path: {
              course_module_id: courseModule.id,
              enabled: courseModule.certification_enabled,
            },
          })
        }
      }
    },
    { notify: true, method: "POST" },
    {
      onSuccess: () => {
        setEdited(false)
        courseStructureQuery.refetch()
        creditRegistrationConfigsQuery.refetch()
      },
    },
  )

  /**
   * Applies one card's fields to the staged list, adding the module when it is not in it yet, so
   * creating and editing take the same path through validation and chapter reassignment.
   */
  const handleSaveModule = (id: string, { starts, ends, ...settings }: CourseModuleFormFields) => {
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
        }
        return c
      })
      const existing = old.modules.find((m) => m.id === id)
      const saved: ModuleView = {
        ...settings,
        id,
        order_number: existing?.order_number ?? old.modules.length,
        // Overwritten below, along with every other module's.
        firstChapter: null,
        lastChapter: null,
        isNew: existing?.isNew ?? true,
      }
      const upserted = existing
        ? old.modules.map((m) => (m.id === id ? saved : m))
        : [...old.modules, saved]
      // The saved module claimed chapters from its neighbours, so every module's span has moved.
      const modules = upserted.map((m) => {
        const [first, last] = firstAndLastChaptersOfModule(m.id, chapters)
        return { ...m, firstChapter: first, lastChapter: last }
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

  return (
    <QueryResults
      queries={[courseStructureQuery, creditRegistrationConfigsQuery] as const}
      treatEmptyAsData
      renderData={([data]) => (
        <>
          <div className={sectionsCss}>
            <h1 className={pageTitleCss}>{t("modules")}</h1>
            {moduleUpdatesMutation.isError && <ErrorNotice error={moduleUpdatesMutation.error} />}
            {moduleList?.modules
              .toSorted((l, r) => {
                return l.order_number - r.order_number
              })
              .map((module) => {
                const initialModule = initialModuleList?.modules.find((m) => m.id === module.id)
                const moduleChapters = moduleList.chapters.filter((c) => c.module === module.id)
                const registrationSummary = registrationSummaries?.find(
                  (summary) => summary.course_module_id === module.id,
                )
                return (
                  <CourseModuleForm
                    key={module.id}
                    mode={EDIT}
                    module={module}
                    chapters={data.chapterNumbers}
                    creditRegistrationConfig={creditRegistrationConfigs?.find(
                      (config) => config.course_module_id === module.id,
                    )}
                    linkedExams={linkedExams}
                    exercises={exercises}
                    links={links}
                    canToggleCertificates={initialModule?.certification_enabled ?? false}
                    hasUnsavedChanges={
                      edited &&
                      (initialModule === undefined ||
                        !isEqual(savedFieldsOf(module), savedFieldsOf(initialModule)))
                    }
                    onSubmitForm={handleSaveModule}
                    onDeleteModule={handleDeleteModule}
                  >
                    {registrationSummary && (
                      <ModuleRegistrationStatus
                        summary={registrationSummary}
                        rosterHrefOf={(failed) => rosterHrefOf(courseId, module.id, failed)}
                      />
                    )}
                    {moduleChapters.length > 0 && (
                      <div className={subsectionCss}>
                        <h2 className={subheadingCss}>{t("heading-module-chapters")}</h2>
                        <ul className={dividedListCss}>
                          {moduleChapters.map((c) => (
                            <li key={c.id}>
                              {c.chapter_number}. {c.name}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </CourseModuleForm>
                )
              })}
            {newModule ? (
              <CourseModuleForm
                mode={CREATE}
                module={newModule}
                chapters={data.chapterNumbers}
                creditRegistrationConfig={undefined}
                linkedExams={linkedExams}
                exercises={exercises}
                links={links}
                canToggleCertificates={false}
                onSubmitForm={handleSaveModule}
                onCancel={() => setNewModule(null)}
              />
            ) : (
              <div>
                <Button
                  variant="secondary"
                  size="medium"
                  type="button"
                  onClick={() => setNewModule(blankModule(data.chapterNumbers))}
                >
                  {t("button-text-add-module")}
                </Button>
              </div>
            )}
          </div>
          <BottomPanel
            title={t("title-dialog-module-save")}
            {...omitUndefined({ error: moduleList?.error })}
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
        </>
      )}
    />
  )
}

export default CourseModules

import { css } from "@emotion/css"
import CancelIcon from "@mui/icons-material/Cancel"
import CheckIcon from "@mui/icons-material/Check"
import DeleteIcon from "@mui/icons-material/Delete"
import EditIcon from "@mui/icons-material/Edit"
import { IconButton } from "@mui/material"
import { useQuery } from "@tanstack/react-query"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"
import { v4 } from "uuid"

import { submitChanges as submitModuleChanges } from "../../../../../../services/backend/course-modules"
import { fetchCourseStructure } from "../../../../../../services/backend/courses"
import Button from "../../../../../../shared-module/components/Button"
import ErrorBanner from "../../../../../../shared-module/components/ErrorBanner"
import SelectField from "../../../../../../shared-module/components/InputFields/SelectField"
import TextField from "../../../../../../shared-module/components/InputFields/TextField"
import Spinner from "../../../../../../shared-module/components/Spinner"
import useToastMutation from "../../../../../../shared-module/hooks/useToastMutation"
import { baseTheme, theme } from "../../../../../../shared-module/styles"
import { respondToOrLarger } from "../../../../../../shared-module/styles/respond"
import BottomPanel from "../../../../../BottomPanel"

interface Props {
  courseId: string
}

type ModuleView = {
  id: string
  name: string | null
  order_number: number
  firstChapter: number | null
  lastChapter: number | null
  isNew: boolean
}

type ChapterView = { id: string; name: string; module: string | null; chapter_number: number }

type ModuleList = {
  modules: Array<ModuleView>
  chapters: Array<ChapterView>
  error: string | null
}

const CourseModules: React.FC<Props> = ({ courseId }) => {
  const { t } = useTranslation()

  // new module state
  const [chapterNumbers, setChapterNumbers] = useState([1])
  const [newModuleName, setNewModuleName] = useState("")
  const [newModuleStartChapter, setNewModuleStartChapter] = useState(1)
  const [newModuleEndChapter, setNewModuleEndChapter] = useState(1)
  const firstChapter = chapterNumbers[0]
  const lastChapter = chapterNumbers[chapterNumbers.length - 1]

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

  // editing module state
  const [editingModuleId, setEditingModuleId] = useState<string | null>(null)
  const [editingModuleName, setEditingModuleName] = useState<string | null>(null)
  const [editingModuleStarts, setEditingModuleStarts] = useState(firstChapter)
  const [editingModuleEnds, setEditingModuleEnds] = useState(lastChapter)

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
      console.log(chapter)
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
  const resetNewModuleForm = () => {
    setNewModuleName("")
    setNewModuleStartChapter(firstChapter)
    setNewModuleEndChapter(lastChapter)
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
        setNewModuleStartChapter(chapterNumbers[0])
        setNewModuleEndChapter(chapterNumbers[chapterNumbers.length - 1])

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
      const newModules = new Map<
        string,
        {
          name: string
          order_number: number
          chapters: Array<string>
        }
      >()
      const modifiedModules = new Array<{
        id: string
        name: string | null
        order_number: number
      }>()
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
            })
          } else {
            // old module, check for modifications
            if (
              module.name !== initialModule.name ||
              module.order_number !== initialModule.order_number
            ) {
              modifiedModules.push({
                id: module.id,
                name: module.name !== initialModule.name ? module.name : null,
                order_number: module.order_number,
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

  // onClick functions
  const clickCreateNewModule = () => {
    setEdited(true)
    const newModuleId = v4()
    setModuleList((old) => {
      // update chapters
      const chapters = [...old.chapters]
      chapters.forEach((c) => {
        if (newModuleStartChapter <= c.chapter_number && c.chapter_number <= newModuleEndChapter) {
          c.module = newModuleId
        }
      })

      // update modules
      const modules = [
        ...old.modules,
        {
          id: newModuleId,
          name: newModuleName,
          order_number: 1,
          firstChapter: 1,
          lastChapter: 1,
          isNew: true,
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
    resetNewModuleForm()
  }
  const clickResetModuleForm = resetNewModuleForm
  const clickSaveModuleEdits = () => {
    setEditingModuleId(null)
    setEdited(true)
    setModuleList((old) => {
      const chapters = [...old.chapters]
      chapters.forEach((c) => {
        if (editingModuleStarts <= c.chapter_number && c.chapter_number <= editingModuleEnds) {
          c.module = editingModuleId
        } else if (c.module === editingModuleId) {
          c.module = null
        }
      })
      const modules = [...old.modules]
      modules.forEach((m) => {
        if (m.id === editingModuleId) {
          m.name = editingModuleName
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
  const clickCancelModuleEdits = () => {
    setEditingModuleId(null)
  }
  const clickEditModule = (module: ModuleView) => {
    setEditingModuleId(module.id)
    setEditingModuleName(module.name)
    setEditingModuleStarts(module.firstChapter ?? firstChapter)
    setEditingModuleEnds(module.lastChapter ?? lastChapter)
  }
  const clickDeleteModule = (module: ModuleView) => {
    setEdited(true)
    setModuleList((old) => {
      const modules = old.modules.filter((m) => m.id !== module.id)
      const chapters = [...old.chapters].map((c) => {
        const updated = { ...c }
        if (updated.module === module.id) {
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
  const clickSubmit = () => {
    moduleUpdatesMutation.mutate()
  }
  const clickReset = () => {
    setEditingModuleId(null)
    resetNewModuleForm()
    setEdited(false)
    setModuleList(initialModuleList)
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
        <div
          className={css`
            min-width: 60%;
            padding: 2rem;
            border: 0.1rem solid rgba(205, 205, 205, 0.8);
            margin-bottom: 2rem;
          `}
        >
          <TextField
            label={t("create-module")}
            placeholder={t("name-of-module")}
            value={newModuleName}
            onChange={setNewModuleName}
          />
          <div>{t("select-module-start-end-chapters")}</div>
          <div
            className={css`
              display: flex;
              flex-wrap: wrap;
              flex-direction: row;
              justify-content: space-between;
            `}
          >
            <div
              className={css`
                display: flex;
                flex-direction: row;
                align-items: center;
              `}
            >
              <SelectField
                className={css`
                  min-width: 5rem;
                  margin-right: 1rem;
                `}
                id="new-module-start"
                label={t("starts")}
                options={chapterNumbers.map((cn) => {
                  return { value: cn.toString(), label: cn.toString() }
                })}
                value={newModuleStartChapter.toString()}
                onChange={(val) => setNewModuleStartChapter(parseInt(val))}
              />
              <SelectField
                className={css`
                  min-width: 5rem;
                `}
                id="new-module-ends"
                label={t("ends")}
                options={chapterNumbers.map((cn) => {
                  return { value: cn.toString(), label: cn.toString() }
                })}
                value={newModuleEndChapter.toString()}
                onChange={(val) => setNewModuleEndChapter(parseInt(val))}
              />
            </div>
            <div
              className={css`
                display: flex;
                flex-direction: row;
                justify-content: end;
              `}
            >
              <Button
                className={css`
                  max-height: 3rem;
                  align-self: flex-end;
                  margin: 1rem;
                `}
                size="medium"
                variant="tertiary"
                disabled={newModuleName.length === 0}
                onClick={clickCreateNewModule}
              >
                {t("confirm")}
              </Button>
            </div>
          </div>
        </div>
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
              <div
                className={css`
                  display: flex;
                  flex-wrap: wrap;
                  background-color: ${theme.primary.bg};
                  color: ${theme.primary.text};
                  align-items: center;
                  margin-bottom: 0.5rem;
                  justify-content: space-between;
                `}
              >
                <div
                  className={css`
                    text-transform: uppercase;
                    font-weight: 600;
                    margin: 1rem;
                    flex-grow: 1;
                    ${respondToOrLarger.sm} {
                      max-width: 16rem;
                    }
                  `}
                >
                  {module.name ? (
                    editingModuleId === module.id ? (
                      <TextField
                        label={t("edit-module")}
                        labelStyle={css`
                          color: ${baseTheme.colors.clear[100]};
                        `}
                        placeholder={t("name-of-module")}
                        value={editingModuleName ?? ""}
                        onChange={setEditingModuleName}
                      />
                    ) : (
                      `${module.order_number}: ${module.name}`
                    )
                  ) : (
                    t("default-module")
                  )}
                </div>
                <div
                  className={css`
                    display: flex;
                    flex-wrap: wrap;
                    align-items: flex-end;
                    flex-grow: 1;
                    justify-content: space-between;
                  `}
                >
                  {editingModuleId === module.id ? (
                    <div
                      className={css`
                        display: flex;
                        margin-left: 1rem;
                        margin-right: 1rem;
                        margin-bottom: 1rem;
                      `}
                    >
                      <SelectField
                        className={css`
                          min-width: 5rem;
                          margin-right: 1rem;
                        `}
                        id="editing-module-start"
                        label={t("starts")}
                        labelStyle={css`
                          color: ${baseTheme.colors.clear[100]};
                        `}
                        options={chapterNumbers.map((cn) => {
                          return { value: cn.toString(), label: cn.toString() }
                        })}
                        value={editingModuleStarts.toString()}
                        onChange={(val) => setEditingModuleStarts(parseInt(val))}
                      />
                      <SelectField
                        className={css`
                          min-width: 5rem;
                          margin-left: 1rem;
                        `}
                        id="editing-module-ends"
                        label={t("ends")}
                        labelStyle={css`
                          color: ${baseTheme.colors.clear[100]};
                        `}
                        options={chapterNumbers.map((cn) => {
                          return { value: cn.toString(), label: cn.toString() }
                        })}
                        value={editingModuleEnds.toString()}
                        onChange={(val) => setEditingModuleEnds(parseInt(val))}
                      />
                    </div>
                  ) : (
                    <div></div>
                  )}
                  <div
                    className={css`
                      display: flex;
                      align-items: flex-end;
                    `}
                  >
                    {editingModuleId === module.id ? (
                      <>
                        <IconButton
                          aria-label={t("button-text-save")}
                          className={css`
                            background-color: ${baseTheme.colors.green[400]};
                            border-radius: 0;
                            height: 3.5rem;
                            width: 3.5rem;
                          `}
                          onClick={clickSaveModuleEdits}
                        >
                          <CheckIcon />
                        </IconButton>
                        <IconButton
                          aria-label={t("button-text-cancel")}
                          className={css`
                            background-color: ${baseTheme.colors.green[400]};
                            border-radius: 0;
                            height: 3.5rem;
                            width: 3.5rem;
                          `}
                          onClick={clickCancelModuleEdits}
                        >
                          <CancelIcon />
                        </IconButton>
                      </>
                    ) : (
                      <IconButton
                        aria-label={t("edit")}
                        className={css`
                          background-color: ${baseTheme.colors.green[400]};
                          border-radius: 0;
                          height: 3.5rem;
                          width: 3.5rem;
                        `}
                        onClick={() => clickEditModule(module)}
                      >
                        <EditIcon />
                      </IconButton>
                    )}
                    {module.name !== null && (
                      <IconButton
                        aria-label={t("button-text-delete")}
                        className={css`
                          background-color: ${baseTheme.colors.green[300]};
                          border-radius: 0;
                          height: 3.5rem;
                          width: 3.5rem;
                        `}
                        onClick={() => clickDeleteModule(module)}
                      >
                        <DeleteIcon />
                      </IconButton>
                    )}
                  </div>
                </div>
              </div>
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
        onClickLeft={clickSubmit}
        rightButtonText={t("button-reset")}
        onClickRight={clickReset}
        rightButtonDisabled={submitting}
      />
    </>
  )
}

export default CourseModules

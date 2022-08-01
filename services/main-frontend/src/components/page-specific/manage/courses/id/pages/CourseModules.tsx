import { css } from "@emotion/css"
import CancelIcon from "@mui/icons-material/Cancel"
import CheckIcon from "@mui/icons-material/Check"
import DeleteIcon from "@mui/icons-material/Delete"
import EditIcon from "@mui/icons-material/Edit"
import { IconButton } from "@mui/material"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"
import { useQuery } from "react-query"
import { v4 } from "uuid"

import { submitChanges as submitModuleChanges } from "../../../../../../services/backend/course-modules"
import { fetchCourseStructure } from "../../../../../../services/backend/courses"
import { CourseStructure } from "../../../../../../shared-module/bindings"
import Button from "../../../../../../shared-module/components/Button"
import ErrorBanner from "../../../../../../shared-module/components/ErrorBanner"
import SelectField from "../../../../../../shared-module/components/InputFields/SelectField"
import TextField from "../../../../../../shared-module/components/InputFields/TextField"
import Spinner from "../../../../../../shared-module/components/Spinner"
import useToastMutation from "../../../../../../shared-module/hooks/useToastMutation"

interface Props {
  courseId: string
}

type ModuleView = {
  id: string
  name: string | null
  order_number: number
  firstChapter: number | null
  lastChapter: number | null
}
type ChapterView = { id: string; name: string; module: string | null; chapter_number: number }
type ModuleList = {
  modules: Array<ModuleView>
  chapters: Array<ChapterView>
  error: string | null
}

const CourseModules: React.FC<Props> = ({ courseId }) => {
  const { t } = useTranslation()

  // course structure query
  const courseStructure = useQuery(`course-structure-${courseId}`, () =>
    fetchCourseStructure(courseId),
  )

  // new module state
  const chapterNumbers = courseStructure.isSuccess
    ? courseStructure.data.chapters
        .sort((l, r) => l.chapter_number - r.chapter_number)
        .map((c) => c.chapter_number)
    : [1]
  const firstChapter = chapterNumbers[0]
  const lastChapter = chapterNumbers[chapterNumbers.length - 1]
  const [newModuleName, setNewModuleName] = useState("")
  const [newModuleStartChapter, setNewModuleStartChapter] = useState(firstChapter)
  const [newModuleEndChapter, setNewModuleEndChapter] = useState(lastChapter)

  // module list state
  const validateModuleList = (
    modules: Array<ModuleView>,
    chapters: Array<ChapterView>,
  ): string | null => {
    const seenModules = new Map<string, number>()

    // check that the chapters are continuous to disallow configurations such as:
    // module 1: [chapter 1, chapter 3], module 2: [chapter 2]
    chapters.sort((l, r) => l.chapter_number - r.chapter_number)
    let currentModule: string | null = null
    for (const chapter of chapters) {
      if (chapter.module !== null) {
        if (chapter.module !== currentModule) {
          currentModule = chapter.module
          // should be unseen module
          const prevChapter = seenModules.get(chapter.module)
          if (prevChapter !== undefined) {
            return t("error-modules-noncontinuous-chapters", {
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
    for (const module of modules) {
      if (!seenModules.has(module.id)) {
        return t("error-modules-empty-module", { moduleName: module.name })
      }
    }

    // all ok
    return null
  }
  const firstAndLastChapters = (
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
  const dataFromStructure = (courseStructure: CourseStructure): ModuleList => {
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
      const [firstChapter, lastChapter] = firstAndLastChapters(m.id, chapters)
      return { id: m.id, name: m.name, order_number: m.order_number, firstChapter, lastChapter }
    })
    const error = validateModuleList(modules, chapters)
    return { modules, chapters, error }
  }
  const initialModuleList = courseStructure.isSuccess
    ? dataFromStructure(courseStructure.data)
    : { modules: [], chapters: [], error: null }
  const [{ modules, chapters, error }, setModuleList] = useState(initialModuleList)

  // editing module state
  const [editingModule, setEditingModule] = useState<string | null>(null)
  const [editingModuleName, setEditingModuleName] = useState("")
  const [editingModuleStarts, setEditingModuleStarts] = useState(firstChapter)
  const [editingModuleEnds, setEditingModuleEnds] = useState(lastChapter)
  const sortAndUpdateOrderNumbers = (modules: Array<ModuleView>): Array<ModuleView> => {
    modules.sort((l, r) => {
      // sort default module first
      if (l.name === null) {
        return -1
      } else if (r.name === null) {
        1
      }
      // sort according to first chapters, chapterless modules last
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
  const insertNewModule = () => {
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
        },
      ]
      modules.forEach((m) => {
        const [first, last] = firstAndLastChapters(m.id, chapters)
        m.firstChapter = first
        m.lastChapter = last
      })

      return {
        modules,
        chapters,
        error: validateModuleList(modules, chapters),
      }
    })

    // reset form
    setNewModuleName("")
    setNewModuleStartChapter(firstChapter)
    setNewModuleEndChapter(lastChapter)
  }

  // update state
  const [submitting, setSubmitting] = useState(false)
  const postModuleUpdates = useToastMutation(
    () => {
      setSubmitting(true)
      const idToInitialModule = initialModuleList.modules.reduce<Map<string, ModuleView>>(
        (map, module) => map.set(module.id, module),
        new Map(),
      )
      const idToInitialChapter = initialModuleList.chapters.reduce<Map<string, ChapterView>>(
        (map, chapter) => map.set(chapter.id, chapter),
        new Map(),
      )
      const idToUpdatedModule = modules.reduce<Map<string, ModuleView>>(
        (map, module) => map.set(module.id, module),
        new Map(),
      )

      // check new and modified modules
      const newModules = new Array<{
        name: string
        order_number: number
        chapters: Array<string>
      }>()
      const modifiedModules = new Array<{ id: string; name: string; order_number: number }>()
      for (const module of modules) {
        if (module.name !== null) {
          // cannot add or modify default module
          const initialModule = idToInitialModule.get(module.id)
          if (initialModule === undefined) {
            newModules.push({
              name: module.name,
              order_number: module.order_number,
              chapters: chapters.filter((c) => c.module === module.id).map((c) => c.id),
            })
          } else {
            if (
              module.name !== initialModule.name ||
              module.order_number !== initialModule.order_number
            ) {
              modifiedModules.push({
                id: module.id,
                name: module.name,
                order_number: module.order_number,
              })
            }
          }
        }
      }

      // check deleted modules
      const deletedModules = new Array<string>()
      for (const module of initialModuleList.modules) {
        if (!idToUpdatedModule.has(module.id)) {
          deletedModules.push(module.id)
        }
      }

      // check moved chapters
      const movedChapters = new Array<[string, string]>()
      for (const chapter of chapters) {
        const initialChapter = idToInitialChapter.get(chapter.id)
        if (
          initialChapter !== undefined &&
          chapter.module !== null &&
          initialChapter.module !== chapter.module
        ) {
          movedChapters.push([chapter.id, chapter.module])
        }
      }

      return submitModuleChanges(
        courseId,
        newModules,
        deletedModules,
        modifiedModules,
        movedChapters,
      )
    },
    { notify: true, method: "POST" },
    {
      onSuccess: () => {
        courseStructure.refetch()
      },
      onSettled: () => {
        setSubmitting(false)
      },
    },
  )

  if (courseStructure.isError) {
    return <ErrorBanner variant={"link"} error={courseStructure.error} />
  } else if (courseStructure.isLoading || courseStructure.isIdle) {
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
                onBlur={() => {
                  //
                }}
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
                onBlur={() => {
                  //
                }}
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
                `}
                size="medium"
                variant="tertiary"
                disabled={newModuleName.length === 0}
                onClick={insertNewModule}
              >
                {t("confirm")}
              </Button>
              <Button
                className={css`
                  max-height: 3rem;
                  margin-left: 1rem;
                `}
                size="medium"
                variant="outlined"
                onClick={() => {
                  setNewModuleName("")
                  setNewModuleStartChapter(firstChapter)
                  setNewModuleEndChapter(lastChapter)
                }}
              >
                {t("button-restore")}
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
                min-width: 80%;
              `}
              key={module.id}
            >
              <div
                className={css`
                  background-color: #44827e;
                  color: #ffffff;
                  height: ${editingModule === module.id ? "7rem" : "3.5rem"};
                  min-width: 80%;
                  display: flex;
                  align-items: center;
                  margin-bottom: 0.5rem;
                  justify-content: space-between;
                `}
              >
                <div
                  className={css`
                    margin-left: 2rem;
                    text-transform: uppercase;
                    font-weight: 600;
                  `}
                >
                  {module.name ? (
                    editingModule === module.id ? (
                      <TextField
                        label={t("edit-module")}
                        placeholder={t("name-of-module")}
                        value={editingModuleName}
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
                    align-items: center;
                  `}
                >
                  {editingModule === module.id ? (
                    <>
                      <SelectField
                        className={css`
                          min-width: 5rem;
                          margin-right: 1rem;
                        `}
                        id="editing-module-start"
                        label={t("starts")}
                        options={chapterNumbers.map((cn) => {
                          return { value: cn.toString(), label: cn.toString() }
                        })}
                        value={editingModuleStarts.toString()}
                        onChange={(val) => setEditingModuleStarts(parseInt(val))}
                        onBlur={() => {
                          //
                        }}
                      />
                      <SelectField
                        className={css`
                          min-width: 5rem;
                          margin-right: 1rem;
                        `}
                        id="editing-module-ends"
                        label={t("ends")}
                        options={chapterNumbers.map((cn) => {
                          return { value: cn.toString(), label: cn.toString() }
                        })}
                        value={editingModuleEnds.toString()}
                        onChange={(val) => setEditingModuleEnds(parseInt(val))}
                        onBlur={() => {
                          //
                        }}
                      />
                      <IconButton
                        className={css`
                          background-color: #6a9b98;
                          border-radius: 0;
                          height: 3.5rem;
                          width: 3.5rem;
                        `}
                        onClick={() => {
                          setModuleList((old) => {
                            const chapters = [...old.chapters]
                            chapters.forEach((c) => {
                              if (
                                editingModuleStarts <= c.chapter_number &&
                                c.chapter_number <= editingModuleEnds
                              ) {
                                c.module = editingModule
                              } else if (c.module === editingModule) {
                                c.module = null
                              }
                            })
                            const modules = [...old.modules]
                            modules.forEach((m) => {
                              if (m.id === editingModule) {
                                m.name = editingModuleName
                              }
                              const [first, last] = firstAndLastChapters(m.id, chapters)
                              m.firstChapter = first
                              m.lastChapter = last
                            })
                            return {
                              modules: sortAndUpdateOrderNumbers(modules),
                              chapters,
                              error: validateModuleList(modules, chapters),
                            }
                          })
                          setEditingModule(null)
                        }}
                      >
                        <CheckIcon />
                      </IconButton>
                      <IconButton
                        className={css`
                          background-color: #6a9b98;
                          border-radius: 0;
                          height: 3.5rem;
                          width: 3.5rem;
                        `}
                        onClick={() => {
                          setEditingModule(null)
                        }}
                      >
                        <CancelIcon />
                      </IconButton>
                    </>
                  ) : (
                    <IconButton
                      className={css`
                        background-color: #6a9b98;
                        border-radius: 0;
                        height: 3.5rem;
                        width: 3.5rem;
                      `}
                      onClick={() => {
                        setEditingModule(module.id)
                        setEditingModuleName(module.name ?? "")
                        setEditingModuleStarts(module.firstChapter ?? firstChapter)
                        setEditingModuleEnds(module.lastChapter ?? lastChapter)
                      }}
                    >
                      <EditIcon />
                    </IconButton>
                  )}

                  <IconButton
                    className={css`
                      background-color: #8fb4b2;
                      border-radius: 0;
                      height: 3.5rem;
                      width: 3.5rem;
                    `}
                    onClick={() => {
                      setModuleList((old) => {
                        const modules = [...old.modules].filter((m) => m.id !== module.id)
                        const chapters = [...old.chapters]
                        chapters.forEach((c) => {
                          if (c.module === module.id) {
                            c.module = null
                          }
                        })
                        return {
                          modules: sortAndUpdateOrderNumbers(modules),
                          chapters,
                          error: validateModuleList(modules, chapters),
                        }
                      })
                    }}
                  >
                    <DeleteIcon />
                  </IconButton>
                </div>
              </div>
              {chapters
                .filter((c) => c.module === module.id)
                .map((c) => (
                  <div
                    className={css`
                      background-color: #dae6e5;
                      color: #065853;
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
      <div
        className={css`
          position: fixed;
          bottom: 2rem;
          right: 2rem;
          z-index: 1;
          text-align: right;
        `}
      >
        {error !== null && <div>{`${t("error-title")}: ${error}`}</div>}
        <Button
          variant="primary"
          size="large"
          disabled={error !== null || submitting === true}
          onClick={() => {
            postModuleUpdates.mutate()
          }}
        >
          {t("save-changes")}
        </Button>
      </div>
    </>
  )
}

export default CourseModules

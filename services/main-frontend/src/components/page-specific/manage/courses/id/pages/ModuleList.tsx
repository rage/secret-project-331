import { css } from "@emotion/css"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"
import { QueryObserverResult, RefetchOptions, RefetchQueryFilters } from "react-query"
import { v4 } from "uuid"

import { updateCourseModules } from "../../../../../../services/backend/course-modules"
import {
  Chapter,
  CourseStructure,
  Module,
  ModuleUpdate,
  NewModule,
} from "../../../../../../shared-module/bindings"
import Button from "../../../../../../shared-module/components/Button"
import SelectField from "../../../../../../shared-module/components/InputFields/SelectField"
import TextField from "../../../../../../shared-module/components/InputFields/TextField"
import useToastMutation from "../../../../../../shared-module/hooks/useToastMutation"

interface Props {
  courseId: string
  courseStructure: CourseStructure
  refetch: (
    options?: (RefetchOptions & RefetchQueryFilters<unknown>) | undefined,
  ) => Promise<QueryObserverResult<CourseStructure, unknown>>
}

interface ModuleChanges {
  nameChanges: Record<string, string>
  orderChanges: Record<string, number>
  chapterChanges: Record<string, string>
  newModules: Set<string>
  deletions: Set<string>
}

const ModuleList: React.FC<Props> = ({ courseId, courseStructure, refetch }) => {
  const { t } = useTranslation()

  const prepareModules = (courseStructure: CourseStructure) => {
    // get modules from course structure
    const modules: Array<[Module, Array<Chapter>]> = []
    const moduleIndices: Map<string, number> = new Map()
    for (const module of courseStructure.modules) {
      moduleIndices.set(module.id, modules.length)
      modules.push([module, []])
    }
    for (const chapter of courseStructure.chapters) {
      if (chapter.module !== null) {
        const idx = moduleIndices.get(chapter.module)
        if (idx !== undefined) {
          modules[idx][1].push(chapter)
        }
      }
    }
    for (const [_module, chapters] of modules) {
      chapters.sort((a, b) => a.chapter_number - b.chapter_number)
    }
    return modules
  }
  const [moduleList, setModuleList] = useState<Array<[Module, Array<Chapter>]>>(
    prepareModules(courseStructure),
  )
  const [editingModules, setEditingModules] = useState<boolean>(false)
  const [newModuleName, setNewModuleName] = useState<string>("")
  const [moduleChanges, setModuleChanges] = useState<ModuleChanges>({
    nameChanges: {},
    orderChanges: {},
    chapterChanges: {},
    newModules: new Set(),
    deletions: new Set(),
  })

  const resetEdits = () => {
    setEditingModules(false)
    setNewModuleName("")
    setModuleChanges({
      nameChanges: {},
      orderChanges: {},
      chapterChanges: {},
      newModules: new Set(),
      deletions: new Set(),
    })
  }

  const saveModulesMutation = useToastMutation(
    () => {
      // collect chapter changes for each module
      const moduleChapters: Record<string, Array<string>> = {}
      Object.entries(moduleChanges.chapterChanges).map(([chapterId, moduleId]) => {
        if (!(moduleId in moduleChapters)) {
          moduleChapters[moduleId] = []
        }
        moduleChapters[moduleId].push(chapterId)
      })

      const newModules: Array<NewModule> = []
      moduleChanges.newModules.forEach((newModule) => {
        // ignore deleted modules
        if (!moduleChanges.deletions.has(newModule)) {
          newModules.push({
            name: moduleChanges.nameChanges[newModule],
            order_number: moduleChanges.orderChanges[newModule],
            chapters: moduleChapters[newModule] || [],
          })
        }
      })

      const deleted = Array.from(moduleChanges.deletions.keys()).filter(
        // ignore new modules
        (d) => !moduleChanges.newModules.has(d),
      )
      const updated: Record<string, ModuleUpdate> = {}
      const updatedModules: Array<string> = [
        ...Object.keys(moduleChanges.nameChanges),
        ...Object.keys(moduleChanges.orderChanges),
        ...Object.keys(moduleChanges.chapterChanges),
      ]
      for (const updatedModule of updatedModules) {
        // ignore new modules
        if (!moduleChanges.newModules.has(updatedModule)) {
          updated[updatedModule] = {
            new_name: moduleChanges.nameChanges[updatedModule],
            new_order_number: moduleChanges.orderChanges[updatedModule],
            new_chapters: moduleChapters[updatedModule] || [],
          }
        }
      }
      return updateCourseModules(courseId, { new: newModules, deleted, updated })
    },
    {
      notify: true,
      method: "POST",
    },
    {
      onSuccess: async () => {
        const refetched = await refetch()
        if (refetched.data) {
          setModuleList(prepareModules(refetched.data))
        }
        resetEdits()
      },
    },
  )

  return (
    <>
      <h2
        className={css`
          margin-top: 4rem;
        `}
      >
        {t("modules")}
      </h2>
      {!editingModules && (
        <Button size="medium" variant="primary" onClick={() => setEditingModules(true)}>
          {t("edit")}
        </Button>
      )}
      {editingModules && (
        <>
          <Button size="medium" variant="primary" onClick={() => saveModulesMutation.mutate()}>
            {t("save-changes")}
          </Button>
          <Button size="medium" variant="tertiary" onClick={() => resetEdits()}>
            {t("button-text-cancel")}
          </Button>
          <TextField
            value={newModuleName}
            label={t("new-module-name")}
            onChange={(val) => setNewModuleName(val)}
          />
          <Button
            size="medium"
            variant="primary"
            disabled={newModuleName.length === 0}
            onClick={() => {
              const tempId = v4()
              const newModuleOrderNumber = moduleList.length + 1
              setModuleChanges((old) => {
                const updated = { ...old }
                updated.newModules.add(tempId)
                updated.nameChanges[tempId] = newModuleName
                updated.orderChanges[tempId] = newModuleOrderNumber
                return updated
              })
              setModuleList((old) => {
                return [
                  ...old,
                  [
                    {
                      id: v4(),
                      name: newModuleName,
                      order_number: newModuleOrderNumber,
                      is_default: false,
                    },
                    [],
                  ],
                ]
              })
              setNewModuleName("")
            }}
          >
            {t("add-module")}
          </Button>
        </>
      )}
      {moduleList
        .sort((a, b) => a[0].order_number - b[0].order_number)
        .map(([module, chapters]) => (
          <>
            {!editingModules && <div key={module.id}>{module.name}</div>}
            {editingModules && (
              <div key={module.id}>
                <TextField
                  label={t("module-name")}
                  defaultValue={module.name}
                  onChange={(newName) => {
                    setModuleChanges((old) => {
                      const changes = { ...old }
                      changes.nameChanges[module.id] = newName
                      return changes
                    })
                  }}
                />
                <TextField
                  label={t("order-number")}
                  defaultValue={module.order_number.toString()}
                  onChange={(newOrderNumber) => {
                    setModuleChanges((old) => {
                      const updated = { ...old }
                      updated.orderChanges[module.id] = Number(newOrderNumber)
                      return updated
                    })
                  }}
                />
                <Button
                  size="medium"
                  variant="tertiary"
                  onClick={() => {
                    // add to deletions
                    setModuleChanges((old) => {
                      const updated = { ...old }
                      updated.deletions.add(module.id)
                      return updated
                    })
                    // remove from module list
                    setModuleList((old) => old.filter(([m, _chapters]) => m.id !== module.id))
                  }}
                  disabled={chapters.length !== 0}
                >
                  {t("button-text-delete")}
                </Button>
              </div>
            )}
            <ul>
              {chapters.map((chapter) => (
                <li key={chapter.id}>
                  <>
                    {chapter.name}{" "}
                    {editingModules && (
                      <>
                        <SelectField
                          id="chapter-module-selection"
                          options={moduleList.map(([m, _cs]) => {
                            return { value: m.id, label: m.name }
                          })}
                          defaultValue={chapter.module || ""}
                          onBlur={() => {
                            //
                          }}
                          onChange={(targetModule) => {
                            setModuleChanges((old) => {
                              const updated = { ...old }
                              updated.chapterChanges[chapter.id] = targetModule
                              return updated
                            })
                            // move chapter to module
                            setModuleList((old) => {
                              return old.map(([oldModule, oldChapters]) => {
                                if (oldModule.id === targetModule) {
                                  // add to target module
                                  chapter.module = targetModule
                                  return [oldModule, [...oldChapters, chapter]]
                                } else if (oldModule.id === module.id) {
                                  // remove from this module
                                  return [oldModule, oldChapters.filter((c) => c.id !== chapter.id)]
                                } else {
                                  return [oldModule, oldChapters]
                                }
                              })
                            })
                          }}
                        />
                      </>
                    )}
                  </>
                </li>
              ))}
            </ul>
          </>
        ))}
    </>
  )
}

export default ModuleList

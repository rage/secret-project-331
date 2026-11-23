import React, { useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"

import basePath from "@/lib/basePath"
import Button from "@/shared-module/common/components/Button"
import CheckBox from "@/shared-module/common/components/InputFields/CheckBox"
import TextField from "@/shared-module/common/components/InputFields/TextField"
import Spinner from "@/shared-module/common/components/Spinner"
import type { RepositoryExercise } from "@/util/exerciseServiceApi"
import type { ExerciseEditorState, ExerciseIframeState } from "@/util/stateInterfaces"

const EDITOR_ANSWER = "editor"
const BROWSER_ANSWER = "browser"

interface Props {
  state: ExerciseEditorState
  setState: (updater: (state: ExerciseIframeState | null) => ExerciseIframeState | null) => void
  requestRepositoryExercises: () => void
}

/** Exercises matching `filter` in their part, name or repository, grouped by part in part order. */
export function groupByPart(
  exercises: RepositoryExercise[],
  filter: string,
): [part: string, exercises: RepositoryExercise[]][] {
  const needle = filter.trim().toLowerCase()
  const parts = new Map<string, RepositoryExercise[]>()
  for (const exercise of exercises) {
    const haystack = `${exercise.part} ${exercise.name} ${exercise.repository_url}`.toLowerCase()
    if (needle === "" || haystack.includes(needle)) {
      parts.set(exercise.part, [...(parts.get(exercise.part) ?? []), exercise])
    }
  }
  return [...parts.entries()]
    .toSorted(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
    .map(([part, inPart]) => [
      part,
      inPart.toSorted((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })),
    ])
}

/**
 * Whether the template has Python files, which is all the in-browser tests are built for. Null
 * while unknown, including when the template could not be read.
 */
function useIsPythonExercise(templateDownloadUrl: string | null): boolean | null {
  const [isPython, setIsPython] = useState<boolean | null>(null)
  useEffect(() => {
    if (templateDownloadUrl === null) {
      return undefined
    }
    let cancelled = false
    setIsPython(null)
    fetch(`${basePath()}/api/extract-stub`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ stub_download_url: templateDownloadUrl }),
    })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error("no files"))))
      .then((body: { files: { filepath: string }[] }) => {
        if (!cancelled) {
          setIsPython(body.files.some((file) => file.filepath.endsWith(".py")))
        }
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [templateDownloadUrl])
  return isPython
}

interface PickerProps {
  repositoryExercises: RepositoryExercise[]
  onSelect: (exercise: RepositoryExercise) => void
}

const RepositoryExercisePicker: React.FC<PickerProps> = ({ repositoryExercises, onSelect }) => {
  const { t } = useTranslation()
  const [filter, setFilter] = useState("")
  const groups = useMemo(
    () => groupByPart(repositoryExercises, filter),
    [repositoryExercises, filter],
  )
  if (repositoryExercises.length === 0) {
    return <div>{t("no-repository-exercises-found")}</div>
  }
  return (
    <>
      <div>{t("select-repository-exercise")}</div>
      <TextField
        type="text"
        label={t("filter-repository-exercises")}
        value={filter}
        onChangeByValue={setFilter}
      />
      {groups.length === 0 && <div>{t("no-matching-repository-exercises")}</div>}
      {groups.map(([part, exercises]) => (
        <section key={part}>
          <h3>{part}</h3>
          <ul>
            {exercises.map((exercise) => (
              <li key={exercise.id}>
                <Button variant="primary" size="medium" onClick={() => onSelect(exercise)}>
                  {exercise.name} ({exercise.repository_url})
                </Button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  )
}

const ExerciseEditor: React.FC<React.PropsWithChildren<Props>> = ({
  state,
  setState,
  requestRepositoryExercises,
}) => {
  const { t } = useTranslation()
  const isPython = useIsPythonExercise(state.private_spec?.repository_exercise.download_url ?? null)

  // oxlint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => requestRepositoryExercises(), [])

  const selectExercise = (type: "browser" | "editor", repositoryExercise: RepositoryExercise) =>
    setState((old) =>
      old ? { ...old, private_spec: { type, repository_exercise: repositoryExercise } } : null,
    )

  // cms editor view
  if (state.private_spec === null) {
    // no exercise selected yet: treat null/undefined as loading, [] as empty
    if (state.repository_exercises === null || state.repository_exercises === undefined) {
      return <Spinner />
    }
    return (
      <RepositoryExercisePicker
        repositoryExercises={state.repository_exercises}
        onSelect={(exercise) => selectExercise(EDITOR_ANSWER, exercise)}
      />
    )
  }
  // exercise selected
  const repositoryExercise = state.private_spec.repository_exercise
  const browserUnavailable = isPython === false
  return (
    <div>
      {t("selected-repository-exercise")}
      <br />
      {repositoryExercise.part} / {repositoryExercise.name}
      <br />
      {repositoryExercise.repository_url}
      <br />
      {repositoryExercise.download_url}
      <br />
      {state.private_spec.type}
      <br />
      <CheckBox
        label={t("solve-in-editor-label")}
        checked={state.private_spec.type === "editor"}
        onChange={() => selectExercise(EDITOR_ANSWER, repositoryExercise)}
      />
      <CheckBox
        label={t("solve-in-browser")}
        checked={state.private_spec.type === "browser"}
        disabled={browserUnavailable && state.private_spec.type !== "browser"}
        onChange={() => selectExercise(BROWSER_ANSWER, repositoryExercise)}
      />
      <div>
        {browserUnavailable ? t("browser-solving-not-python") : t("browser-solving-python-only")}
      </div>
      <Button
        variant="primary"
        size="medium"
        onClick={() => setState((old) => (old ? { ...old, private_spec: null } : null))}
      >
        {t("select-another-repository-exercise")}
      </Button>
    </div>
  )
}

export default ExerciseEditor

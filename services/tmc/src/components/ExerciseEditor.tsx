import React, { useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"

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
 * The tmc-langs plugin the exercise service found the exercise to use, or null when the repository
 * has not been synced since the service started reporting it.
 */
export function exercisePlugin(exercise: RepositoryExercise): string | null {
  const details = exercise.details
  return typeof details === "object" &&
    details !== null &&
    "plugin" in details &&
    typeof details.plugin === "string"
    ? details.plugin
    : null
}

/** Only Python exercises can be solved in the browser, whose tests run in Pyodide. */
const BROWSER_PLUGIN = "python3"

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

  // oxlint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => requestRepositoryExercises(), [])

  const setAnswerType = (type: "browser" | "editor") =>
    setState((old) =>
      old?.view_type === "exercise-editor" && old.private_spec
        ? { ...old, private_spec: { ...old.private_spec, type } }
        : old,
    )
  const pickExercise = (repositoryExercise: RepositoryExercise) =>
    setState((old) =>
      old
        ? {
            ...old,
            private_spec: { type: EDITOR_ANSWER, repository_exercise: repositoryExercise },
            picked_repository_exercise_id: repositoryExercise.id,
          }
        : null,
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
        onSelect={pickExercise}
      />
    )
  }
  // exercise selected
  const repositoryExercise = state.private_spec.repository_exercise
  // The host's listing carries the current details; the spec's copy may predate them.
  const plugin = exercisePlugin(
    state.repository_exercises?.find((exercise) => exercise.id === repositoryExercise.id) ??
      repositoryExercise,
  )
  const browserUnavailable = plugin !== null && plugin !== BROWSER_PLUGIN
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
        onChange={() => setAnswerType(EDITOR_ANSWER)}
      />
      <CheckBox
        label={t("solve-in-browser")}
        checked={state.private_spec.type === "browser"}
        disabled={browserUnavailable && state.private_spec.type !== "browser"}
        onChange={() => setAnswerType(BROWSER_ANSWER)}
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

import { MessageChannel } from "node:worker_threads"

import { Zstd } from "@hpcc-js/wasm-zstd"
import { act, renderHook, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import type { AnswerFileRef } from "@/shared-module/exercise-protocol/core/exercise-service-protocol-types"
import { tarStudentFiles } from "@/util/canonicalArchive"
import type { RepositoryExercise } from "@/util/exerciseServiceApi"
import { draftBasis, draftKey, loadDraft, saveDraft } from "@/util/localDraft"
import type { AnswerExerciseState, PrivateSpec, PublicSpec } from "@/util/stateInterfaces"

import { currentStateMessage, useIframeProtocol } from "./useIframeProtocol"

const REPOSITORY_EXERCISE: RepositoryExercise = {
  id: "e48717c3-fd7d-41e9-a2e5-36ce06fcd943",
  repository_id: "4d24291f-dd61-43cc-83e2-4707a7278425",
  part: "part01",
  name: "ex01",
  repository_url: "https://github.com/testmycode/tmc-testcourse",
  checksum: [1, 2, 3, 4],
  download_url: "http://files.example/template.tar.zst",
}

const PRIVATE_SPEC: PrivateSpec = { type: "browser", repository_exercise: REPOSITORY_EXERCISE }

const PUBLIC_SPEC: PublicSpec = {
  type: "browser",
  archive_name: "part01-ex01.tar.zst",
  stub_download_url: "http://files.example/stub.tar.zst",
  student_file_paths: [],
  checksum: "abc",
}

/** Editor mode has no in-browser editor, so seeding reads no archive and needs no network. */
const EDITOR_PUBLIC_SPEC: PublicSpec = { ...PUBLIC_SPEC, type: "editor" }

const answerState = (uploadedArchiveId: string | null): AnswerExerciseState => ({
  view_type: "answer-exercise",
  public_spec: PUBLIC_SPEC,
  editor_files: [{ filepath: "src/main.py", contents: "print(1)" }],
  starting_files: [{ filepath: "src/main.py", contents: "" }],
  draft: null,
  uploaded_archive_id: uploadedArchiveId,
  previous_submission: null,
})

describe("currentStateMessage", () => {
  it("reports an answer as the single archive it consists of, with no data of its own", () => {
    expect(currentStateMessage(answerState("6b1c1f5e-08a1-4d0e-9f2b-3b6dd2f1c001"))).toEqual({
      message: "current-state",
      data: null,
      files: ["6b1c1f5e-08a1-4d0e-9f2b-3b6dd2f1c001"],
      valid: true,
    })
  })

  // Nothing to submit until the edited files have been packed and stored.
  it("reports an answer with no uploaded archive as invalid", () => {
    expect(currentStateMessage(answerState(null))).toEqual({
      message: "current-state",
      data: null,
      valid: false,
    })
  })

  it("reports the exercise editor's private spec and that it references no files", () => {
    expect(
      currentStateMessage({
        view_type: "exercise-editor",
        exercise_task_id: "8a0a5d4c-5f0f-4d0e-9f2b-3b6dd2f1c002",
        repository_exercises: null,
        private_spec: PRIVATE_SPEC,
      }),
    ).toEqual({
      message: "current-state",
      data: { private_spec: PRIVATE_SPEC },
      private_spec_files: [],
      valid: true,
    })
  })

  it("reports the repository exercise only once the teacher has picked one", () => {
    expect(
      currentStateMessage({
        view_type: "exercise-editor",
        exercise_task_id: "8a0a5d4c-5f0f-4d0e-9f2b-3b6dd2f1c002",
        repository_exercises: null,
        private_spec: PRIVATE_SPEC,
        picked_repository_exercise_id: REPOSITORY_EXERCISE.id,
      }),
    ).toMatchObject({ repository_exercise_id: REPOSITORY_EXERCISE.id })
  })

  it("reports nothing for an exercise editor without a private spec", () => {
    expect(
      currentStateMessage({
        view_type: "exercise-editor",
        exercise_task_id: "8a0a5d4c-5f0f-4d0e-9f2b-3b6dd2f1c002",
        repository_exercises: null,
        private_spec: null,
      }),
    ).toBeNull()
  })

  it("reports nothing while viewing a submission, which is not an answer being written", () => {
    expect(
      currentStateMessage({
        view_type: "view-submission",
        exercise_task_id: "8a0a5d4c-5f0f-4d0e-9f2b-3b6dd2f1c002",
        grading: null,
        submitted_files: [],
        submitted_archive_url: null,
        public_spec: PUBLIC_SPEC,
        model_solution_spec: null,
        model_solution_files: [],
      }),
    ).toBeNull()
  })
})

const openHostChannels: MessageChannel[] = []

afterEach(() => {
  openHostChannels.splice(0).forEach((channel) => {
    channel.port1.close()
    channel.port2.close()
  })
})

/**
 * Drives the parent side of the handshake and collects what the iframe posts back.
 *
 * jsdom's own MessagePort cannot deliver messages (the test setup replaces MessageChannel with an
 * inert stub), so the port pair comes from Node.
 */
function connectAsHost(): {
  postAndSettle: (message: unknown) => Promise<void>
  received: unknown[]
} {
  const channel = new MessageChannel()
  openHostChannels.push(channel)
  const received: unknown[] = []
  channel.port1.on("message", (message) => received.push(message))
  const handshake = new Event("message")
  Object.assign(handshake, { source: window.parent, ports: [channel.port2] })
  act(() => {
    window.dispatchEvent(handshake)
  })
  return {
    postAndSettle: async (message) => {
      channel.port1.postMessage(message)
      // Both the port delivery and the iframe's reply cross the event loop.
      await new Promise((resolve) => {
        setTimeout(resolve, 0)
      })
    },
    received,
  }
}

const TASK_ID = "2c7d2b3a-6f2e-4f1e-9a5e-8f2f5c1a9b01"
const USER_ID = "6a1c9f2e-4b8d-4a0c-8e1f-2d3c4b5a6f02"

const setStateMessage = (
  previousSubmissionFiles: AnswerFileRef[],
  publicSpec: PublicSpec = EDITOR_PUBLIC_SPEC,
) => ({
  message: "set-state",
  view_type: "answer-exercise",
  exercise_task_id: TASK_ID,
  user_information: { pseudonymous_id: USER_ID, signed_in: true },
  data: {
    public_spec: publicSpec,
    // A tmc answer has no data of its own; the host passes the answer's data here.
    previous_submission: null,
    previous_submission_files: previousSubmissionFiles,
  },
})

const PREVIOUS_ARCHIVE: AnswerFileRef = {
  id: "0d0a8f74-1f7a-4c0b-9c2e-16f1a1c0f003",
  url: "http://files.example/previous.tar.zst",
  name: "submission.tar.zst",
  mime: "application/x-zstd-compressed-tar",
}

describe("useIframeProtocol", () => {
  it("posts a valid answer naming the previous submission's archive when one is seeded", async () => {
    renderHook(() => useIframeProtocol())
    const host = connectAsHost()

    await act(() => host.postAndSettle(setStateMessage([PREVIOUS_ARCHIVE])))

    expect(host.received.at(-1)).toEqual({
      message: "current-state",
      data: null,
      files: [PREVIOUS_ARCHIVE.id],
      valid: true,
    })
  })

  it("posts an invalid answer when there is no previous submission to seed from", async () => {
    renderHook(() => useIframeProtocol())
    const host = connectAsHost()

    await act(() => host.postAndSettle(setStateMessage([])))

    expect(host.received.at(-1)).toEqual({ message: "current-state", data: null, valid: false })
  })
})

/**
 * Serves an answer archive whose `src/main.py` is `submitted` for the previous submission, and
 * `stub` (the same by default) for the stub.
 */
async function serveArchive(stub = "print('submitted')\n") {
  const zstd = await Zstd.load()
  const pack = (contents: string) =>
    zstd.compress(
      tarStudentFiles("ex01", [
        { path: "src/main.py", contents: new TextEncoder().encode(contents) },
      ]),
    )
  const previousArchive = pack("print('submitted')\n")
  const stubArchive = pack(stub)
  const realFetch = globalThis.fetch
  vi.stubGlobal(
    "fetch",
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (!url.startsWith("http://files.example/")) {
        return realFetch(input, init)
      }
      const archive = url === PUBLIC_SPEC.stub_download_url ? stubArchive : previousArchive
      return Promise.resolve(new Response(new Uint8Array(archive), { status: 200 }))
    }),
  )
}

describe("useIframeProtocol drafts", () => {
  const BROWSER_SPEC: PublicSpec = {
    ...PUBLIC_SPEC,
    student_file_paths: ["src/main.py"],
    main_file: "src/main.py",
    archive_prefix: "ex01",
  }
  const KEY = draftKey(USER_ID, TASK_ID)
  const DRAFT = [{ filepath: "src/main.py", contents: "print('draft')\n" }]

  afterEach(() => {
    window.localStorage.clear()
    vi.unstubAllGlobals()
  })

  it("restores a draft edited from the submission the editor opens, and uploads it", async () => {
    await serveArchive()
    saveDraft(KEY, DRAFT, draftBasis(BROWSER_SPEC.checksum, PREVIOUS_ARCHIVE.id))
    const { result } = renderHook(() => useIframeProtocol())
    const host = connectAsHost()

    await act(() => host.postAndSettle(setStateMessage([PREVIOUS_ARCHIVE], BROWSER_SPEC)))

    await waitFor(() =>
      expect(result.current.state).toMatchObject({
        editor_files: DRAFT,
        uploaded_archive_id: null,
      }),
    )
    await waitFor(
      () =>
        expect(
          host.received.some((m) => (m as { message?: string }).message === "file-upload"),
        ).toBe(true),
      { timeout: 3000 },
    )
  })

  it("keeps a reset to the stub after a submission as a draft", async () => {
    await serveArchive("# write your code here\n")
    const { result } = renderHook(() => useIframeProtocol())
    const host = connectAsHost()
    await act(() => host.postAndSettle(setStateMessage([PREVIOUS_ARCHIVE], BROWSER_SPEC)))
    await waitFor(() =>
      expect(result.current.state).toMatchObject({ uploaded_archive_id: PREVIOUS_ARCHIVE.id }),
    )
    const stub = [{ filepath: "src/main.py", contents: "# write your code here\n" }]

    act(() => {
      result.current.setAnswerFiles(stub)
    })

    await waitFor(() => expect(loadDraft(KEY)?.files).toEqual(stub), { timeout: 3000 })
  })

  it("saves an edit as a draft at once, without waiting for the upload debounce", async () => {
    await serveArchive()
    const { result } = renderHook(() => useIframeProtocol())
    const host = connectAsHost()
    await act(() => host.postAndSettle(setStateMessage([PREVIOUS_ARCHIVE], BROWSER_SPEC)))
    await waitFor(() =>
      expect(result.current.state).toMatchObject({ uploaded_archive_id: PREVIOUS_ARCHIVE.id }),
    )

    act(() => {
      result.current.setAnswerFiles(DRAFT)
    })

    expect(loadDraft(KEY)?.files).toEqual(DRAFT)
    expect(host.received.some((m) => (m as { message?: string }).message === "file-upload")).toBe(
      false,
    )
  })

  it("keeps a newer submission and forgets a draft edited from an older starting point", async () => {
    await serveArchive()
    saveDraft(KEY, DRAFT, draftBasis(BROWSER_SPEC.checksum, null))
    const { result } = renderHook(() => useIframeProtocol())
    const host = connectAsHost()

    await act(() => host.postAndSettle(setStateMessage([PREVIOUS_ARCHIVE], BROWSER_SPEC)))

    await waitFor(() =>
      expect(result.current.state).toMatchObject({
        editor_files: [{ filepath: "src/main.py", contents: "print('submitted')\n" }],
        uploaded_archive_id: PREVIOUS_ARCHIVE.id,
      }),
    )
    expect(loadDraft(KEY)).toBeNull()
  })
})

/**
 * Client for the mock Suotar's world and fault control (`/api/v0/mock-suotar/control/command`).
 *
 * Hand-written because the mock's DTOs are deliberately not exported to `bindings.ts`, the same way
 * `mock_sisu`'s are not. One named function per command, so call sites stay greppable by name rather
 * than by variant string. `suotarControl.ts` is the tick client and stays separate.
 *
 * Isolation here is data partitioning, not serialization: different spec files run concurrently, so
 * a spec owns a distinct combination of users and courses and asserts on those. Commands marked
 * unsafe below reach data your spec does not own — `GET /control/commands` lists which.
 *
 * Nothing polls on its own; compose these with `pollUntil` from `waitingUtils`.
 */

import type { APIRequestContext } from "@playwright/test"

import { CONTROL_BASE_URL } from "./suotarControl"

export type MockSuotarEndpoint =
  | "resolve_persons"
  | "resolve_enrolments"
  | "import_attainments"
  | "verify_attainments"
  | "product_access_tokens"
  | "list_by_course"

/** Required on every fault. A post-commit stage means something different from a pre-write one. */
export type MockSuotarStage =
  | "auth"
  | "requestGate"
  | "parse"
  | "resolve"
  | "afterWrite"
  | "respond"

export type MockSuotarRipeness = "atImport" | "manual" | { autoAfterVerifyCalls: { calls: number } }

export type MockSuotarEnrolmentState = "ENROLLED" | "PROCESSING" | "REJECTED" | "ABORTED"

export type MockSuotarRealisationKind = "degree" | "openUniversity"

export interface MockSuotarOwnerRef {
  user?: string
  course?: string
}

export interface MockSuotarDatePeriod {
  startDate: string
  endDate: string
}

export interface MockSuotarLocalizedName {
  fi: string
  sv: string
  en: string
}

export interface MockSuotarPersonUpsert {
  studentNumber: string
  personId?: string
  firstNames: string
  lastName: string
  primaryEmail: string
  secondaryEmail?: string
  behaviour?: { ripeness?: MockSuotarRipeness; duplicateDetection?: "detect" | "allowDoubles" }
  ownerUserEmail?: string
}

export interface MockSuotarRealisationUpsert {
  id?: string
  name?: MockSuotarLocalizedName
  assessmentItemId?: string
  kind?: MockSuotarRealisationKind
  activityPeriod: MockSuotarDatePeriod
  gradeScaleId: string
  credits: { min: number; max: number }
  /** Null is how `acceptorNotFound` is reached from data alone; nothing is derived for it. */
  acceptorPersonId?: string | null
  openUniversityProductId?: string | null
}

export interface MockSuotarCourseUnitUpsert {
  courseCode: string
  courseUnitId?: string
  name?: MockSuotarLocalizedName
  realisations?: MockSuotarRealisationUpsert[]
  behaviour?: { importAllowed: boolean }
  ownerCourseSlug?: string
}

export interface MockSuotarEnrolmentUpsert {
  id?: string
  studentNumber: string
  courseCode: string
  realisationId?: string
  kind?: MockSuotarRealisationKind
  state: MockSuotarEnrolmentState
  studyRightId?: string
  studyRightValidityPeriod: MockSuotarDatePeriod
  enrolmentDateTime?: string
}

export interface MockSuotarAttainmentUpsert {
  id?: string
  studentNumber: string
  courseCode: string
  personId?: string
  kind?: MockSuotarRealisationKind
  attainmentType?: string
  state?: "ATTAINED" | "MISREGISTERED" | "FAILED"
  attainmentDate: string
  registrationDate?: string
  gradeScaleId: string
  gradeId: string
  passed?: boolean
}

export interface MockSuotarProductAccessTokenUpsert {
  openUniversityProductId: string
  id?: string
  accessToken?: string
  state?: "ENABLED" | "DISABLED"
  documentState?: "ACTIVE" | "DRAFT" | "DELETED"
}

export interface MockSuotarWorldPush {
  defaults?: Record<string, unknown>
  persons?: MockSuotarPersonUpsert[]
  courseUnits?: MockSuotarCourseUnitUpsert[]
  enrolments?: MockSuotarEnrolmentUpsert[]
  attainments?: MockSuotarAttainmentUpsert[]
  productTokens?: MockSuotarProductAccessTokenUpsert[]
}

export type MockSuotarPredicate =
  | { endpoint: MockSuotarEndpoint }
  | { stage: MockSuotarStage }
  | { studentNumber: string }
  | { courseCode: string }
  | { productId: string }
  | { requestItemId: string }
  | { submittedAttainmentId: string }
  | { owner: MockSuotarOwnerRef }
  | { callOrdinal: number }

export type MockSuotarEffect =
  | {
      kind: "itemLevel"
      code: string
      message?: string
      discloseSubmittedAttainmentId?: boolean
    }
  | { kind: "requestLevel"; status: number; code: string; message?: string }
  | { kind: "latency"; ms: number }
  | { kind: "hang"; ms: number }
  | { kind: "connectionReset" }
  | { kind: "garbageBody"; status?: number; body?: string }
  | { kind: "wrongContentType"; contentType?: string }
  | { kind: "dropItems"; count?: number; requestItemIds?: string[] }
  | { kind: "reorderItems"; order?: string[] }

/** Omitted means until disarmed. */
export interface MockSuotarLifetime {
  matchingCalls?: number
  matchingItems?: number
  skip?: number
}

export interface MockSuotarFaultSpec {
  /** Caller-supplied, so re-arming replaces rather than duplicates. */
  id: string
  when: MockSuotarPredicate[]
  then: MockSuotarEffect
  lifetime?: MockSuotarLifetime
  /**
   * Only for a spec that is proving the double submission. Arming a retryable code on `import` after
   * the write has committed is refused without it.
   */
  provesDoubleSubmission?: boolean
}

export interface MockSuotarHypotheticalRequest {
  endpoint: MockSuotarEndpoint
  callOrdinal?: number
  items: {
    requestItemId: string
    studentNumber?: string
    courseCode?: string
    submittedAttainmentId?: string
    productId?: string
  }[]
}

export interface MockSuotarCallFilter {
  endpoint?: MockSuotarEndpoint
  studentNumber?: string
  courseCode?: string
  requestItemId?: string
  faultId?: string
  correlationId?: string
  limit?: number
}

export type MockSuotarSubmissionTarget =
  | "registered"
  | "misregistered"
  | "notRegistered"
  | "timedOutButLanded"
  | "timedOutNothingLanded"

export type MockSuotarCommandResult =
  | { status: "ok"; command: string; result: Record<string, unknown> }
  | { status: "error"; command: string | null; code: string; message: string }
  | { status: "notImplemented"; command: string }

const sendCommand = async (
  request: APIRequestContext,
  command: Record<string, unknown>,
): Promise<Record<string, unknown>> => {
  const response = await request.post(`${CONTROL_BASE_URL}/command`, { data: command })
  // A 404 means the mock is not enabled and the whole spec is invalid.
  if (![200, 400, 500, 501].includes(response.status())) {
    throw new Error(
      `Unexpected status ${response.status()} from the mock Suotar control command ${JSON.stringify(
        command.command,
      )}. Is USE_MOCK_SUOTAR_ENDPOINT on? Body: ${await response.text()}`,
    )
  }
  const body = (await response.json()) as MockSuotarCommandResult
  if (body.status !== "ok") {
    throw new Error(
      `Mock Suotar refused ${JSON.stringify(command.command)}: ${JSON.stringify(body)}`,
    )
  }
  return body.result
}

const get = async (request: APIRequestContext, path: string): Promise<Record<string, unknown>> => {
  const response = await request.get(`${CONTROL_BASE_URL}/${path}`)
  if (!response.ok()) {
    throw new Error(
      `Unexpected status ${response.status()} from mock Suotar ${path}. Is USE_MOCK_SUOTAR_ENDPOINT on? Body: ${await response.text()}`,
    )
  }
  return (await response.json()) as Record<string, unknown>
}

/** Throws the whole world away. The next contract request rebuilds the seed's world lazily. */
export const resetMockSuotarWorld = (request: APIRequestContext) =>
  sendCommand(request, { command: "reset", scope: "world" })

export const resetMockSuotarFaults = (request: APIRequestContext) =>
  sendCommand(request, { command: "reset", scope: "faults" })

export const resetMockSuotarCalls = (request: APIRequestContext) =>
  sendCommand(request, { command: "reset", scope: "calls" })

/**
 * Destructive and without an undo: the persons, their submissions and the attainments those created
 * simply stop existing. Reset in `afterAll`, not in `beforeAll` — on master a retried spec would
 * otherwise run against a world its own first attempt emptied.
 */
export const resetMockSuotarPersons = (
  request: APIRequestContext,
  scope: { studentNumbers?: string[]; owner?: MockSuotarOwnerRef },
) => sendCommand(request, { command: "reset", scope: { persons: scope } })

/** Replaces the whole world including its global defaults, so not for the automated suite. */
export const pushMockSuotarWorld = (request: APIRequestContext, world: MockSuotarWorldPush) =>
  sendCommand(request, { command: "pushWorld", ...world })

export const upsertMockSuotarPersons = (
  request: APIRequestContext,
  persons: MockSuotarPersonUpsert[],
) => sendCommand(request, { command: "upsertPersons", persons })

export const upsertMockSuotarCourseUnits = (
  request: APIRequestContext,
  courseUnits: MockSuotarCourseUnitUpsert[],
) => sendCommand(request, { command: "upsertCourseUnits", courseUnits })

export const upsertMockSuotarEnrolments = (
  request: APIRequestContext,
  enrolments: MockSuotarEnrolmentUpsert[],
) => sendCommand(request, { command: "upsertEnrolments", enrolments })

export const upsertMockSuotarAttainments = (
  request: APIRequestContext,
  attainments: MockSuotarAttainmentUpsert[],
) => sendCommand(request, { command: "upsertAttainments", attainments })

export const upsertMockSuotarProductAccessTokens = (
  request: APIRequestContext,
  tokens: MockSuotarProductAccessTokenUpsert[],
) => sendCommand(request, { command: "upsertProductAccessTokens", tokens })

export const deleteMockSuotarPersons = (request: APIRequestContext, studentNumbers: string[]) =>
  sendCommand(request, { command: "deletePersons", studentNumbers })

export const allocateMockSuotarPerson = (
  request: APIRequestContext,
  person: {
    firstNames?: string
    lastName?: string
    primaryEmail?: string
    secondaryEmail?: string
    ownerUserEmail?: string
  } = {},
) => sendCommand(request, { command: "allocatePerson", ...person })

export const generateMockSuotarRoster = (
  request: APIRequestContext,
  roster: {
    courseCode: string
    realisationId: string
    count: number
    studentNumberPrefix?: string
  },
) => sendCommand(request, { command: "generateRoster", ...roster })

export const setMockSuotarPersonBehaviour = (
  request: APIRequestContext,
  studentNumber: string,
  patch: {
    ripeness?: MockSuotarRipeness
    duplicateDetection?: "detect" | "allowDoubles"
    primaryEmail?: string
    secondaryEmail?: string
  },
) => sendCommand(request, { command: "setPersonBehaviour", studentNumber, patch })

export const setMockSuotarCourseBehaviour = (
  request: APIRequestContext,
  courseCode: string,
  patch: { importAllowed?: boolean },
) => sendCommand(request, { command: "setCourseBehaviour", courseCode, patch })

export const transitionMockSuotarSubmission = (
  request: APIRequestContext,
  submittedAttainmentId: string,
  to: MockSuotarSubmissionTarget,
) => sendCommand(request, { command: "transitionSubmission", submittedAttainmentId, to })

/** A spec owns a student number, not the mock-side `hy-kur-…` id the client holds in the database. */
export const transitionMockSuotarSubmissionsFor = (
  request: APIRequestContext,
  studentNumber: string,
  to: MockSuotarSubmissionTarget,
  courseCode?: string,
) =>
  sendCommand(request, {
    command: "transitionSubmissionsFor",
    studentNumber,
    courseCode,
    to,
  })

export const listMockSuotarSubmissions = (
  request: APIRequestContext,
  filter: { studentNumber?: string; courseCode?: string } = {},
) => sendCommand(request, { command: "listSubmissions", ...filter })

export const armMockSuotarFault = (request: APIRequestContext, fault: MockSuotarFaultSpec) =>
  sendCommand(request, { command: "armFault", ...fault })

export const disarmMockSuotarFault = (request: APIRequestContext, id: string) =>
  sendCommand(request, { command: "disarmFault", id })

/** The parallel-safe cleanup an `afterAll` needs. */
export const disarmMockSuotarFaults = (request: APIRequestContext, owner: MockSuotarOwnerRef) =>
  sendCommand(request, { command: "disarmFaults", owner })

export const listMockSuotarFaults = (
  request: APIRequestContext,
  filter: { id?: string; owner?: MockSuotarOwnerRef } = {},
) => sendCommand(request, { command: "listFaults", ...filter })

/**
 * Validates a fault without arming it, and with `against` says per stage whether it would fire and
 * which predicate failed. Paste a logged call straight back in: the item shape is the same.
 */
export const explainMockSuotarFault = (
  request: APIRequestContext,
  fault: MockSuotarFaultSpec,
  against?: MockSuotarHypotheticalRequest,
) => sendCommand(request, { command: "explainFault", fault, against })

/** Global, so a dev and manual-debugging command rather than the suite's. */
export const setMockSuotarDefaults = (request: APIRequestContext, patch: Record<string, unknown>) =>
  sendCommand(request, { command: "setDefaults", patch })

export const applyMockSuotarScenario = (
  request: APIRequestContext,
  name: string,
  args: {
    studentNumber?: string
    courseCode?: string
    realisationKind?: MockSuotarRealisationKind
    owner?: MockSuotarOwnerRef
    primaryEmail?: string
    secondaryEmail?: string
    firstNames?: string
    lastName?: string
  } = {},
) => sendCommand(request, { command: "applyScenario", name, args })

/** Bounded: a list has no index, so a filter is always a scan of the newest `limit` entries. */
export const listMockSuotarCalls = (
  request: APIRequestContext,
  filter: MockSuotarCallFilter = {},
) => sendCommand(request, { command: "listCalls", ...filter })

export const getMockSuotarHealth = (request: APIRequestContext) => get(request, "health")

export const getMockSuotarWorld = (request: APIRequestContext) => get(request, "world")

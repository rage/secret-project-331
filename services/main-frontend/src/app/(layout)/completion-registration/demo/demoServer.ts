import type {
  MyCreditJustification,
  RequestCreditRegistrationEnrolmentRecheckResult,
  SetEnrolmentRoutePayload,
} from "@/generated/api/types.generated"

import { DEMO_COURSE_MODULE_ID, DEMO_REGISTRATION_ID, type DemoState } from "./demoData"

const API = "/api/v0/main-frontend"
const MODULE = `${API}/credit-registrations/my/by-course-module/${DEMO_COURSE_MODULE_ID}`
const REGISTRATION = `${API}/credit-registrations/my/${DEMO_REGISTRATION_ID}`

/** The query ids the demo answers, so it can drop their cached fake answers on the way out. */
export const DEMO_QUERY_IDS: ReadonlySet<string> = new Set([
  "getCourseModuleUserCompletion",
  "getMyCreditRegistrationForCourseModule",
  "getMyEnrolmentRoute",
  "getMyVerifiedStudentNumber",
  "getCreditRegistrationSettings",
])

const json = (body: unknown): Response =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  })

/**
 * A `fetch` answering the registration page's requests from `state`, which its buttons change, and
 * passing every other request through.
 *
 * Also answers the student-number and settings endpoints for anything else on screen, which is why
 * the demo drops those cached answers when it goes.
 */
export const createDemoFetch =
  (state: DemoState, passThrough: typeof fetch) =>
  async (request: Request): Promise<Response> => {
    const path = new URL(request.url, window.location.origin).pathname
    const nowIso = new Date().toISOString()
    const route = state.enrolmentRoute
    switch (`${request.method} ${path}`) {
      case `GET ${API}/course-modules/${DEMO_COURSE_MODULE_ID}/user-completion`:
        return json(state.completion)
      case `GET ${MODULE}`:
        return json(state.registration)
      case `GET ${MODULE}/enrolment-route`:
        return json(route)
      case `PUT ${MODULE}/enrolment-route`: {
        const answers = (await request.json()) as SetEnrolmentRoutePayload
        state.enrolmentRoute = {
          ...route,
          ...answers,
          // Like the server: "I have enrolled" was about the old route.
          enrolment_confirmed_at:
            answers.route === route.route ? (route.enrolment_confirmed_at ?? null) : null,
        }
        return json(state.enrolmentRoute)
      }
      case `POST ${MODULE}/enrolment-route/certificate-choice`:
        state.enrolmentRoute = { ...route, certificate_chosen_at: nowIso }
        return json(state.enrolmentRoute)
      case `DELETE ${MODULE}/enrolment-route/certificate-choice`:
        state.enrolmentRoute = { ...route, certificate_chosen_at: null }
        return json(state.enrolmentRoute)
      case `POST ${MODULE}/enrolment-route/confirm`:
        state.enrolmentRoute = { ...route, enrolment_confirmed_at: nowIso }
        return json(state.enrolmentRoute)
      case `DELETE ${MODULE}/enrolment-route/confirm`:
        state.enrolmentRoute = { ...route, enrolment_confirmed_at: null }
        return json(state.enrolmentRoute)
      case `PUT ${MODULE}/credit-justification`: {
        const body = (await request.json()) as { justification: string }
        state.completion = { ...state.completion, credit_justification: body.justification }
        return json({
          course_module_completion_id: state.completion.course_module_completion_id,
          justification: body.justification,
          updated_at: nowIso,
        } satisfies MyCreditJustification)
      }
      case `POST ${MODULE}/enrolment-page-visit`:
      case `POST ${REGISTRATION}/dismiss-enrolment-banner`:
        return json(null)
      case `POST ${REGISTRATION}/recheck-enrolment`:
        return json({
          recheck_started: true,
        } satisfies RequestCreditRegistrationEnrolmentRecheckResult)
      case `GET ${API}/credit-registrations/my/student-number`:
        return json(state.studentNumber)
      case `GET ${API}/credit-registrations/settings`:
        return json({ account_linking_enabled: true })
      default:
        return passThrough(request)
    }
  }

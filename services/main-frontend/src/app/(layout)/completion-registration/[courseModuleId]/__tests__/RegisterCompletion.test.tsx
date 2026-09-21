"use client"

import "@testing-library/jest-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"

import RegisterCompletion, { type RegisterCompletionProps } from "../RegisterCompletion"

jest.mock("@/generated/api/sdk.generated", () => ({
  setMyCreditJustification: jest.fn(),
}))

const { setMyCreditJustification } = jest.requireMock("@/generated/api/sdk.generated") as {
  setMyCreditJustification: jest.Mock
}

const CERTIFICATE_CONFIGURATION_ID = "certificate-configuration-1"

// t is mocked in tests/setup-jest.js to return the key verbatim.
const renderPage = (overrides: Partial<RegisterCompletionProps> = {}) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <RegisterCompletion
        courseModuleId="module-1"
        email="teacher@example.com"
        courseName="Automatic Completions"
        ectsCredits={5}
        registrationFormUrl="/completion-registration/module-1/redirect"
        certificateConfigurationId={null}
        creditJustification={null}
        {...overrides}
      />
    </QueryClientProvider>,
  )
}

/** Every question on the page answers yes/no or certificate/credits, so queries have to be scoped. */
const question = (name: string) => within(screen.getByRole("radiogroup", { name }))

const STUDENT_TYPE = "are-you-a-student-or-exchange-student-at-uh"
const FINNISH_ID = "are-you-finnish-or-do-you-have-a-finnish-personal-identity-code"
const WHICH_DO_YOU_NEED = "which-do-you-need"
const IDENTIFICATION = "how-will-you-identify-yourself"
const RECONSIDER = "reconsider-which-do-you-need"

const answer = (name: string, option: string | RegExp) => {
  fireEvent.click(question(name).getByRole("radio", { name: option }))
}

/** Q1 = No, then credits, then no Suomi.fi method, then credits again: the only way to Screen 5. */
const walkToTheLastQuestion = () => {
  answer(STUDENT_TYPE, "no")
  answer(FINNISH_ID, "no")
  answer(WHICH_DO_YOU_NEED, "credits-in-the-uh-study-registry")
  answer(IDENTIFICATION, /choose-this-if-you-are-not-sure-which-option-applies-to-you/)
  answer(RECONSIDER, "credits-in-the-uh-study-registry")
}

const openUniversityContentIsVisible = () =>
  screen.queryByText("use-this-email-on-enrollment-form-or-credits-wont-register") !== null

describe("RegisterCompletion", () => {
  beforeEach(() => {
    setMyCreditJustification.mockReset()
    setMyCreditJustification.mockResolvedValue({})
  })

  it("names the task first and the course under it, so the page says what it is for", () => {
    renderPage()

    expect(
      screen.getByRole("heading", { level: 1, name: "register-completion" }),
    ).toBeInTheDocument()
    expect(screen.getByText(/Automatic Completions/)).toBeInTheDocument()
    expect(screen.getByText("credits-n-ects")).toBeInTheDocument()
  })

  it("asks the student type as a yes/no choice that is still a radio group", () => {
    renderPage()

    expect(screen.getAllByRole("radio")).toHaveLength(2)
    expect(screen.getByRole("radio", { name: "yes" })).toBeInTheDocument()
    expect(screen.getByRole("radio", { name: "no" })).toBeInTheDocument()
  })

  it("holds back the instructions until the student has answered", () => {
    renderPage()

    expect(screen.queryByText("sisu-email-matching-explanation")).not.toBeInTheDocument()
    expect(
      screen.queryByText("use-this-email-on-enrollment-form-or-credits-wont-register"),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByText("changed-email-since-completing-course-disclosure-title"),
    ).not.toBeInTheDocument()
  })

  it("sends a University of Helsinki student to Sisu", () => {
    renderPage()

    answer(STUDENT_TYPE, "yes")

    expect(screen.getByText("enroll-through-sisu-to-register-credits")).toBeInTheDocument()
    expect(screen.getByText("sisu-email-matching-explanation")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "go-to-sisu" })).toBeInTheDocument()
    expect(screen.queryByRole("link", { name: "to-the-registration-form" })).not.toBeInTheDocument()
  })

  it("sends everyone else to the Open University form", () => {
    renderPage()

    answer(STUDENT_TYPE, "no")

    expect(
      screen.getByText("use-this-email-on-enrollment-form-or-credits-wont-register"),
    ).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "to-the-registration-form" })).toHaveAttribute(
      "href",
      "/completion-registration/module-1/redirect",
    )
    expect(screen.queryByRole("link", { name: "go-to-sisu" })).not.toBeInTheDocument()
  })

  it("offers the changed-address note once the student has an answer to act on", () => {
    renderPage()

    answer(STUDENT_TYPE, "no")

    expect(
      screen.getByText("changed-email-since-completing-course-disclosure-title"),
    ).toBeInTheDocument()
  })

  it("keeps the already-enrolled note on the Sisu path, where enrolling is the task", () => {
    renderPage()

    answer(STUDENT_TYPE, "no")
    expect(screen.queryByText("already-enrolled-in-sisu-disclosure-title")).not.toBeInTheDocument()

    answer(STUDENT_TYPE, "yes")
    expect(screen.getByText("already-enrolled-in-sisu-disclosure-title")).toBeInTheDocument()
  })

  it("asks nothing extra when the module has no certificate to offer instead", () => {
    renderPage()

    answer(STUDENT_TYPE, "no")

    expect(screen.queryByRole("radiogroup", { name: FINNISH_ID })).not.toBeInTheDocument()
    expect(openUniversityContentIsVisible()).toBe(true)
  })

  describe("with a certificate the student could take instead", () => {
    const renderWithCertificate = (overrides: Partial<RegisterCompletionProps> = {}) =>
      renderPage({ certificateConfigurationId: CERTIFICATE_CONFIGURATION_ID, ...overrides })

    it("holds back the Open University instructions until the detour has been answered", () => {
      renderWithCertificate()

      answer(STUDENT_TYPE, "no")

      expect(screen.getByRole("radiogroup", { name: FINNISH_ID })).toBeInTheDocument()
      expect(openUniversityContentIsVisible()).toBe(false)
      expect(
        screen.queryByText("changed-email-since-completing-course-disclosure-title"),
      ).not.toBeInTheDocument()
    })

    it("asks nothing more of a student who has a Finnish personal identity code", () => {
      renderWithCertificate()

      answer(STUDENT_TYPE, "no")
      answer(FINNISH_ID, "yes")

      expect(openUniversityContentIsVisible()).toBe(true)
      expect(screen.queryByRole("radiogroup", { name: WHICH_DO_YOU_NEED })).not.toBeInTheDocument()
    })

    it("ends at the certificate, with nothing about email matching under it", () => {
      renderWithCertificate()

      answer(STUDENT_TYPE, "no")
      answer(FINNISH_ID, "no")
      answer(WHICH_DO_YOU_NEED, "a-certificate-of-completion")

      expect(screen.getByRole("link", { name: "go-to-certificate" })).toHaveAttribute(
        "href",
        `/generate-certificate?module=module-1&ccid=${CERTIFICATE_CONFIGURATION_ID}`,
      )
      expect(openUniversityContentIsVisible()).toBe(false)
      expect(screen.queryByRole("radiogroup", { name: IDENTIFICATION })).not.toBeInTheDocument()
      expect(
        screen.queryByText("changed-email-since-completing-course-disclosure-title"),
      ).not.toBeInTheDocument()
    })

    it("asks how a student wanting the credits will identify themselves", () => {
      renderWithCertificate()

      answer(STUDENT_TYPE, "no")
      answer(FINNISH_ID, "no")
      answer(WHICH_DO_YOU_NEED, "credits-in-the-uh-study-registry")

      const options = question(IDENTIFICATION).getAllByRole("radio")
      expect(options).toHaveLength(3)
      expect(
        question(IDENTIFICATION).getByText(
          "https://www.suomi.fi/instructions-and-support/identification/information-on-identification-tokens-used-in-suomi-fi-e-identification",
        ),
      ).toBeInTheDocument()
      expect(
        question(IDENTIFICATION).getByText(
          "choose-this-if-you-are-not-sure-which-option-applies-to-you",
        ),
      ).toBeInTheDocument()
    })

    it("tips a student identifying with eIDAS and then lets them on", () => {
      renderWithCertificate()

      answer(STUDENT_TYPE, "no")
      answer(FINNISH_ID, "no")
      answer(WHICH_DO_YOU_NEED, "credits-in-the-uh-study-registry")
      answer(IDENTIFICATION, /yes-with-eidas/)

      expect(
        screen.getByText("tip-in-sisu-choose-suomi-fi-e-identification-then-eidas"),
      ).toBeInTheDocument()
      expect(openUniversityContentIsVisible()).toBe(true)
      expect(screen.queryByRole("radiogroup", { name: RECONSIDER })).not.toBeInTheDocument()
    })

    it("tips a student identifying with another Suomi.fi method and then lets them on", () => {
      renderWithCertificate()

      answer(STUDENT_TYPE, "no")
      answer(FINNISH_ID, "no")
      answer(WHICH_DO_YOU_NEED, "credits-in-the-uh-study-registry")
      answer(IDENTIFICATION, /yes-with-another-suomi-fi-identification-method/)

      expect(
        screen.getByText("tip-in-sisu-choose-suomi-fi-e-identification-then-your-method"),
      ).toBeInTheDocument()
      expect(
        screen.queryByText("tip-in-sisu-choose-suomi-fi-e-identification-then-eidas"),
      ).not.toBeInTheDocument()
      expect(openUniversityContentIsVisible()).toBe(true)
    })

    it("offers the certificate once more to a student facing a manual identity check", () => {
      renderWithCertificate()

      answer(STUDENT_TYPE, "no")
      answer(FINNISH_ID, "no")
      answer(WHICH_DO_YOU_NEED, "credits-in-the-uh-study-registry")
      answer(IDENTIFICATION, /choose-this-if-you-are-not-sure-which-option-applies-to-you/)
      answer(RECONSIDER, "a-certificate-of-completion")

      expect(screen.getByRole("link", { name: "go-to-certificate" })).toBeInTheDocument()
      expect(openUniversityContentIsVisible()).toBe(false)
    })

    it("asks why the credits are needed after all", () => {
      renderWithCertificate()

      walkToTheLastQuestion()

      expect(
        screen.getByText("tell-us-why-you-need-the-credits-instead-of-a-certificate"),
      ).toBeInTheDocument()
      expect(screen.getByRole("textbox", { name: "label-your-reason" })).toBeInTheDocument()
      expect(openUniversityContentIsVisible()).toBe(false)
    })

    it("says an empty answer is not one rather than saving it", async () => {
      renderWithCertificate()

      walkToTheLastQuestion()
      fireEvent.click(screen.getByRole("button", { name: "continue" }))

      expect(
        await screen.findByText("tell-us-briefly-why-you-need-the-credits"),
      ).toBeInTheDocument()
      expect(setMyCreditJustification).not.toHaveBeenCalled()
      expect(openUniversityContentIsVisible()).toBe(false)
    })

    it("saves the answer and only then shows where to enrol", async () => {
      renderWithCertificate()

      walkToTheLastQuestion()
      fireEvent.change(screen.getByRole("textbox", { name: "label-your-reason" }), {
        target: { value: "  My employer needs them in the registry.  " },
      })
      fireEvent.click(screen.getByRole("button", { name: "continue" }))

      await waitFor(() => {
        expect(openUniversityContentIsVisible()).toBe(true)
      })
      expect(setMyCreditJustification).toHaveBeenCalledWith({
        path: { course_module_id: "module-1" },
        body: { justification: "My employer needs them in the registry." },
      })
      expect(screen.getByText("your-answer-has-been-saved")).toBeInTheDocument()
    })

    it("reports a failed save instead of letting the button look inert", async () => {
      setMyCreditJustification.mockRejectedValue(new Error("nope"))
      renderWithCertificate()

      walkToTheLastQuestion()
      fireEvent.change(screen.getByRole("textbox", { name: "label-your-reason" }), {
        target: { value: "I need the credits." },
      })
      fireEvent.click(screen.getByRole("button", { name: "continue" }))

      expect(await screen.findByText("credit-justification-save-failed")).toBeInTheDocument()
      expect(openUniversityContentIsVisible()).toBe(false)
      expect(screen.getByRole("textbox", { name: "label-your-reason" })).toBeInTheDocument()
    })

    it("seeds the field from an answer given earlier and shows where to enrol straight away", () => {
      renderWithCertificate({ creditJustification: "Written last time." })

      walkToTheLastQuestion()

      expect(screen.getByRole("textbox", { name: "label-your-reason" })).toHaveValue(
        "Written last time.",
      )
      expect(openUniversityContentIsVisible()).toBe(true)
      expect(setMyCreditJustification).not.toHaveBeenCalled()
    })

    it("collapses the detour when an answer above it changes, and restores it when it changes back", () => {
      renderWithCertificate()

      walkToTheLastQuestion()
      answer(FINNISH_ID, "yes")

      expect(screen.queryByRole("radiogroup", { name: WHICH_DO_YOU_NEED })).not.toBeInTheDocument()
      expect(screen.queryByRole("radiogroup", { name: RECONSIDER })).not.toBeInTheDocument()
      expect(openUniversityContentIsVisible()).toBe(true)

      answer(FINNISH_ID, "no")

      expect(screen.getByRole("radiogroup", { name: RECONSIDER })).toBeInTheDocument()
      expect(screen.getByRole("textbox", { name: "label-your-reason" })).toBeInTheDocument()
      expect(openUniversityContentIsVisible()).toBe(false)
    })
  })
})

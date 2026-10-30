"use client"

import "@testing-library/jest-dom"
import { act, render, screen } from "@testing-library/react"

import type { PreviewPage } from "@/generated/api/types.generated"

import StagedPageContent from "../StagedPageContent"

// Stands in for the course material renderer: renders overridden blocks through the overrides,
// and everything else as a heading with ids and references, the way real blocks do.
jest.mock("@/components/course-material/ContentRenderer", () => {
  // jest.mock factories can't use the file's imports.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const react: typeof import("react") = require("react")
  const {
    createContext,
    createElement,
    useContext: useContextInMock,
    useEffect: useEffectInMock,
    useState: useStateInMock,
  } = react
  const BlockRendererOverridesContext = createContext<
    Record<string, React.ComponentType<Record<string, unknown>>>
  >({})
  const LateBlock = () => {
    const [isShown, setIsShown] = useStateInMock(false)
    useEffectInMock(() => {
      const timer = setTimeout(() => setIsShown(true), 5)
      return () => clearTimeout(timer)
    }, [])
    return isShown ? createElement("p", { id: "late" }, "Rendered late") : null
  }
  const FakeContentRenderer = ({
    data,
  }: {
    data: { name: string; clientId: string; attributes: Record<string, unknown> }[]
  }) => {
    const overrides = useContextInMock(BlockRendererOverridesContext)
    return createElement(
      "div",
      null,
      data.map((block) => {
        if (block.name === "test/late") {
          return createElement(LateBlock, { key: block.clientId })
        }
        const Override = overrides[block.name]
        if (Override) {
          return createElement(Override, { key: block.clientId, id: block.clientId, data: block })
        }
        return createElement(
          "section",
          { key: block.clientId, id: block.clientId, "aria-labelledby": `${block.clientId}-title` },
          createElement("h1", { id: `${block.clientId}-title` }, String(block.attributes.title)),
          createElement("a", { href: `#${block.clientId}` }, "Back to the block"),
        )
      }),
    )
  }
  return { __esModule: true, default: FakeContentRenderer, BlockRendererOverridesContext }
})

jest.mock("@/components/course-material/ContentRenderer/util/InnerBlocks", () => ({
  __esModule: true,
  default: ({ parentBlockProps }: { parentBlockProps: { data: { innerBlocks: unknown[] } } }) => (
    <div data-testid="inner-blocks">{parentBlockProps.data.innerBlocks.length} inner blocks</div>
  ),
}))

jest.mock("citation-js", () => ({
  __esModule: true,
  default: (reference: string) => ({ format: () => `Formatted ${reference}` }),
}))

const block = (name: string, clientId: string, innerBlocks: unknown[] = []) => ({
  name,
  clientId,
  isValid: true,
  attributes: { title: `Title of ${clientId}` },
  innerBlocks,
})

const page = (content: unknown[]): PreviewPage => ({
  id: "page",
  course_id: "course",
  chapter_id: null,
  url_path: "/page",
  title: "Page",
  hidden: false,
  order_number: 1,
  content: content as PreviewPage["content"],
  exercises: [],
})

describe("StagedPageContent", () => {
  it("lists the references the page cites", () => {
    const cited = {
      ...block("core/paragraph", "cited"),
      attributes: { content: "See \\cite{key1}" },
    }
    render(
      <StagedPageContent
        page={page([cited])}
        references={[
          { citation_key: "key1", reference: "ref one" },
          { citation_key: "key2", reference: "ref two" },
        ]}
      />,
    )
    expect(screen.getByText("Formatted ref one")).toBeInTheDocument()
    expect(screen.queryByText("Formatted ref two")).not.toBeInTheDocument()
  })

  it("shows content only some students see, with a note, and names student-specific blocks", () => {
    render(
      <StagedPageContent
        page={page([
          block("moocfi/conditional-block", "conditional", [block("core/paragraph", "p1")]),
          block("moocfi/exercises-in-chapter", "exercises"),
        ])}
      />,
    )
    expect(screen.getByTestId("agent-preview-student-specific-container")).toHaveTextContent(
      "agent-preview-student-specific-container",
    )
    expect(screen.getByTestId("inner-blocks")).toHaveTextContent("1 inner blocks")
    expect(screen.getByTestId("agent-preview-block-placeholder")).toBeInTheDocument()
  })

  it("keeps ids unique and headings below the embedding heading when shown twice", async () => {
    const content = [block("core/heading", "same")]
    const { container } = render(
      <>
        <StagedPageContent page={page(content)} embeddedUnderHeadingLevel={4} />
        <StagedPageContent page={page(content)} embeddedUnderHeadingLevel={4} />
      </>,
    )
    await act(async () => {})

    const ids = [...container.querySelectorAll("[id]")].map((element) => element.id)
    expect(new Set(ids).size).toBe(ids.length)
    const sections = [...container.querySelectorAll("section")]
    expect(sections).toHaveLength(2)
    for (const section of sections) {
      const title = section.querySelector("h1")
      expect(section.getAttribute("aria-labelledby")).toBe(title?.id)
      expect(section.querySelector("a")?.getAttribute("href")).toBe(`#${section.id}`)
      expect(title).toHaveAttribute("aria-level", "5")
    }
  })

  it("leaves a page that isn't embedded as rendered", () => {
    const { container } = render(<StagedPageContent page={page([block("core/heading", "solo")])} />)
    expect(container.querySelector("section")?.id).toBe("solo")
    expect(container.querySelector("h1")).not.toHaveAttribute("aria-level")
  })

  it("also prefixes ids of blocks that render later", async () => {
    const { container } = render(
      <StagedPageContent page={page([block("test/late", "late")])} embeddedUnderHeadingLevel={2} />,
    )
    await act(async () => {
      await new Promise((resolve) => {
        setTimeout(resolve, 20)
      })
    })
    const late = screen.getByText("Rendered late")
    expect(late.id).not.toBe("late")
    expect(late.id).toMatch(/late$/)
    expect(container.querySelector("#late")).toBeNull()
  })

  describe("review instructions", () => {
    const exercisePage = (exercise: Partial<PreviewPage["exercises"][number]>): PreviewPage => ({
      ...page([{ ...block("moocfi/exercise", "exercise"), attributes: { id: "e1" } }]),
      exercises: [
        {
          id: "e1",
          name: "Quiz",
          assignment: [],
          has_reviews: true,
          uses_course_default_review_config: false,
          ...exercise,
        },
      ],
    })

    it("shows an exercise's review instructions", () => {
      render(
        <StagedPageContent
          page={exercisePage({ review_instructions: [block("core/paragraph", "instructions")] })}
        />,
      )
      expect(screen.getByTestId("agent-preview-review-instructions")).toHaveTextContent(
        "title-peer-review-instructions",
      )
    })

    it("says so when the instructions come from the course default", () => {
      render(<StagedPageContent page={exercisePage({ uses_course_default_review_config: true })} />)
      expect(screen.getByTestId("agent-preview-review-instructions-default")).toBeInTheDocument()
    })

    it("shows nothing for an exercise without reviews", () => {
      render(<StagedPageContent page={exercisePage({ has_reviews: false })} />)
      expect(screen.queryByTestId("agent-preview-review-instructions")).toBeNull()
      expect(screen.queryByTestId("agent-preview-review-instructions-default")).toBeNull()
    })
  })
})

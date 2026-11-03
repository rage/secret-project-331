"use client"

import "@testing-library/jest-dom"
import { render } from "@testing-library/react"

import VideoBlock from "../VideoBlock"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const makeProps = (attributes: any): any => ({
  id: "video-block",
  data: {
    name: "core/video",
    isValid: true,
    clientId: "video-block",
    innerBlocks: [],
    attributes: { src: "https://example.com/lecture.mp4", ...attributes },
  },
})

describe("VideoBlock", () => {
  it("renders the block's text tracks", () => {
    const { container } = render(
      <VideoBlock
        {...makeProps({
          tracks: [
            {
              src: "https://example.com/lecture.fi.vtt",
              label: "Suomi",
              srcLang: "fi",
              kind: "captions",
              default: true,
            },
            { src: "https://example.com/lecture.en.vtt", label: "English", srcLang: "en" },
          ],
        })}
      />,
    )
    const tracks = container.querySelectorAll("video > track")
    expect(tracks).toHaveLength(2)
    expect(tracks[0]).toHaveAttribute("kind", "captions")
    expect(tracks[0]).toHaveAttribute("srclang", "fi")
    expect(tracks[0]).toHaveAttribute("label", "Suomi")
    expect(tracks[0]).toHaveAttribute("default")
    expect(tracks[1]).not.toHaveAttribute("default")
  })

  it("renders a video without tracks", () => {
    const { container } = render(<VideoBlock {...makeProps({})} />)
    expect(container.querySelectorAll("track")).toHaveLength(0)
  })
})

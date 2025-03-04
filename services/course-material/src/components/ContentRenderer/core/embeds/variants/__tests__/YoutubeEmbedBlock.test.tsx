import "@testing-library/jest-dom"

import {
  buildYoutubeEmbedUrl,
  parseTimeParameter,
  parseYoutubeUrl,
  YouTubeVideoParams,
} from "../YoutubeEmbedBlock"

// Silence console.error during tests
const originalConsoleError = console.error
beforeAll(() => {
  console.error = jest.fn()
})

afterAll(() => {
  console.error = originalConsoleError
})

describe("parseYoutubeUrl", () => {
  it("extracts video ID and timestamp from youtube.com/watch URLs", () => {
    expect(parseYoutubeUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toEqual({
      videoId: "dQw4w9WgXcQ",
      startTime: null,
      endTime: null,
      embedOptions: {},
    })

    expect(parseYoutubeUrl("https://youtube.com/watch?v=dQw4w9WgXcQ&t=5s")).toEqual({
      videoId: "dQw4w9WgXcQ",
      startTime: "5s",
      endTime: null,
      embedOptions: {},
    })

    expect(parseYoutubeUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=1h2m3s")).toEqual({
      videoId: "dQw4w9WgXcQ",
      startTime: "1h2m3s",
      endTime: null,
      embedOptions: {},
    })
  })

  it("extracts video ID and timestamp from youtu.be URLs", () => {
    expect(parseYoutubeUrl("https://youtu.be/dQw4w9WgXcQ")).toEqual({
      videoId: "dQw4w9WgXcQ",
      startTime: null,
      endTime: null,
      embedOptions: {},
    })

    expect(parseYoutubeUrl("https://youtu.be/dQw4w9WgXcQ?t=30")).toEqual({
      videoId: "dQw4w9WgXcQ",
      startTime: "30",
      endTime: null,
      embedOptions: {},
    })
  })

  it("extracts video ID from youtube.com/embed URLs", () => {
    expect(parseYoutubeUrl("https://www.youtube.com/embed/dQw4w9WgXcQ")).toEqual({
      videoId: "dQw4w9WgXcQ",
      startTime: null,
      endTime: null,
      embedOptions: {},
    })
  })

  it("handles end time parameter", () => {
    expect(parseYoutubeUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ&start=30&end=60")).toEqual({
      videoId: "dQw4w9WgXcQ",
      startTime: "30",
      endTime: "60",
      embedOptions: {},
    })
  })

  it("handles playlist parameters", () => {
    expect(
      parseYoutubeUrl(
        "https://www.youtube.com/watch?v=dQw4w9WgXcQ&listType=playlist&list=PLC77007E23FF423C6",
      ),
    ).toEqual({
      videoId: "dQw4w9WgXcQ",
      startTime: null,
      endTime: null,
      listType: "playlist",
      list: "PLC77007E23FF423C6",
      embedOptions: {},
    })
  })

  it("handles invalid URLs gracefully", () => {
    expect(parseYoutubeUrl("invalid-url")).toEqual({
      videoId: null,
      startTime: null,
      endTime: null,
      embedOptions: {},
    })

    expect(parseYoutubeUrl("")).toEqual({
      videoId: null,
      startTime: null,
      endTime: null,
      embedOptions: {},
    })
  })

  it("handles direct playlist URLs", () => {
    expect(
      parseYoutubeUrl("https://www.youtube.com/playlist?list=PLURsDaOr8hWUWIIHnLycw1ObNaYrp0z4b"),
    ).toEqual({
      videoId: null,
      startTime: null,
      endTime: null,
      listType: "playlist",
      list: "PLURsDaOr8hWUWIIHnLycw1ObNaYrp0z4b",
      embedOptions: {},
    })
  })

  it("handles youtu.be URLs with playlist parameters", () => {
    expect(
      parseYoutubeUrl("https://youtu.be/D28WdFvqwNY?list=PLURsDaOr8hWUWIIHnLycw1ObNaYrp0z4b"),
    ).toEqual({
      videoId: "D28WdFvqwNY",
      startTime: null,
      endTime: null,
      listType: "playlist",
      list: "PLURsDaOr8hWUWIIHnLycw1ObNaYrp0z4b",
      embedOptions: {},
    })
  })

  it("builds URL with both video ID and playlist", () => {
    const params: YouTubeVideoParams = {
      videoId: "D28WdFvqwNY",
      startTime: null,
      endTime: null,
      listType: "playlist",
      list: "PLURsDaOr8hWUWIIHnLycw1ObNaYrp0z4b",
      embedOptions: {},
    }
    expect(buildYoutubeEmbedUrl(params)).toBe(
      "https://www.youtube-nocookie.com/embed/D28WdFvqwNY?listType=playlist&list=PLURsDaOr8hWUWIIHnLycw1ObNaYrp0z4b&rel=0&modestbranding=1",
    )
  })
})

describe("parseTimeParameter", () => {
  it("parses numeric time values", () => {
    expect(parseTimeParameter("30")).toBe(30)
    expect(parseTimeParameter("0")).toBe(0)
  })

  it("parses seconds format", () => {
    expect(parseTimeParameter("45s")).toBe(45)
  })

  it("parses minutes format", () => {
    expect(parseTimeParameter("5m")).toBe(300)
    expect(parseTimeParameter("5m30s")).toBe(330)
  })

  it("parses hours format", () => {
    expect(parseTimeParameter("1h")).toBe(3600)
    expect(parseTimeParameter("1h30m")).toBe(5400)
    expect(parseTimeParameter("1h30m15s")).toBe(5415)
  })

  it("handles invalid time formats", () => {
    expect(parseTimeParameter("")).toBe(0)
    expect(parseTimeParameter("invalid")).toBe(0)
  })
})

describe("buildYoutubeEmbedUrl", () => {
  it("builds basic embed URL", () => {
    const params: YouTubeVideoParams = {
      videoId: "dQw4w9WgXcQ",
      startTime: null,
      endTime: null,
      embedOptions: {},
    }
    expect(buildYoutubeEmbedUrl(params)).toBe(
      "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0&modestbranding=1",
    )
  })

  it("builds URL with start time", () => {
    const params: YouTubeVideoParams = {
      videoId: "dQw4w9WgXcQ",
      startTime: "30",
      endTime: null,
      embedOptions: {},
    }
    expect(buildYoutubeEmbedUrl(params)).toBe(
      "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?start=30&rel=0&modestbranding=1",
    )
  })

  it("builds URL with start and end time", () => {
    const params: YouTubeVideoParams = {
      videoId: "dQw4w9WgXcQ",
      startTime: "30",
      endTime: "60",
      embedOptions: {},
    }
    expect(buildYoutubeEmbedUrl(params)).toBe(
      "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?start=30&end=60&rel=0&modestbranding=1",
    )
  })

  it("builds URL with playlist parameters", () => {
    const params: YouTubeVideoParams = {
      videoId: "dQw4w9WgXcQ",
      startTime: null,
      endTime: null,
      listType: "playlist",
      list: "PLC77007E23FF423C6",
      embedOptions: {},
    }
    expect(buildYoutubeEmbedUrl(params)).toBe(
      "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?listType=playlist&list=PLC77007E23FF423C6&rel=0&modestbranding=1",
    )
  })

  it("adds default parameters to the embed URL", () => {
    const params: YouTubeVideoParams = {
      videoId: "dQw4w9WgXcQ",
      startTime: null,
      endTime: null,
      embedOptions: {},
    }

    expect(buildYoutubeEmbedUrl(params)).toBe(
      "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0&modestbranding=1",
    )
  })

  it("builds URL for playlist without specific video", () => {
    const params: YouTubeVideoParams = {
      videoId: null,
      startTime: null,
      endTime: null,
      listType: "playlist",
      list: "PLC77007E23FF423C6",
      embedOptions: {},
    }
    expect(buildYoutubeEmbedUrl(params)).toBe(
      "https://www.youtube-nocookie.com/embed/videoseries?listType=playlist&list=PLC77007E23FF423C6&rel=0&modestbranding=1",
    )
  })

  it("prioritizes playlist over video ID when both are present", () => {
    const params: YouTubeVideoParams = {
      videoId: "dQw4w9WgXcQ",
      startTime: "30",
      endTime: "60",
      listType: "playlist",
      list: "PLC77007E23FF423C6",
      embedOptions: {},
    }
    expect(buildYoutubeEmbedUrl(params)).toBe(
      "https://www.youtube-nocookie.com/embed/videoseries?listType=playlist&list=PLC77007E23FF423C6&rel=0&modestbranding=1",
    )
  })
})

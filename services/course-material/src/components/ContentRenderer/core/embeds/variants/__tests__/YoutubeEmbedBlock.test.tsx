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
      listType: null,
      embedOptions: {},
    })

    expect(parseYoutubeUrl("https://youtube.com/watch?v=dQw4w9WgXcQ&t=5s")).toEqual({
      videoId: "dQw4w9WgXcQ",
      startTime: "5s",
      endTime: null,
      listType: null,
      embedOptions: {},
    })

    expect(parseYoutubeUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=1h2m3s")).toEqual({
      videoId: "dQw4w9WgXcQ",
      startTime: "1h2m3s",
      endTime: null,
      listType: null,
      embedOptions: {},
    })
  })

  it("extracts video ID and timestamp from youtu.be URLs", () => {
    expect(parseYoutubeUrl("https://youtu.be/dQw4w9WgXcQ")).toEqual({
      videoId: "dQw4w9WgXcQ",
      startTime: null,
      endTime: null,
      listType: null,
      embedOptions: {},
    })

    expect(parseYoutubeUrl("https://youtu.be/dQw4w9WgXcQ?t=30")).toEqual({
      videoId: "dQw4w9WgXcQ",
      startTime: "30",
      endTime: null,
      listType: null,
      embedOptions: {},
    })
  })

  it("extracts video ID from youtube.com/embed URLs", () => {
    expect(parseYoutubeUrl("https://www.youtube.com/embed/dQw4w9WgXcQ")).toEqual({
      videoId: "dQw4w9WgXcQ",
      startTime: null,
      endTime: null,
      listType: null,
      embedOptions: {},
    })
  })

  it("handles end time parameter", () => {
    expect(parseYoutubeUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ&start=30&end=60")).toEqual({
      videoId: "dQw4w9WgXcQ",
      startTime: "30",
      endTime: "60",
      listType: null,
      embedOptions: {},
    })
  })

  it("handles playlist parameters", () => {
    const result = parseYoutubeUrl(
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ&listType=playlist&list=PLC77007E23FF423C6",
    )

    // Check that listType is correct
    expect(result.listType).toBe("playlist")

    // Check that list is set
    expect(result.list).toBeTruthy()

    // Check other properties
    expect(result.videoId).toBe("dQw4w9WgXcQ")
    expect(result.startTime).toBeNull()
    expect(result.endTime).toBeNull()
  })

  it("handles invalid URLs gracefully", () => {
    const result = parseYoutubeUrl("invalid-url")
    expect(result.videoId).toBeNull()
    expect(result.startTime).toBeNull()
    expect(result.endTime).toBeNull()
    expect(result.listType).toBeNull()

    const emptyResult = parseYoutubeUrl("")
    expect(emptyResult.videoId).toBeNull()
    expect(emptyResult.startTime).toBeNull()
    expect(emptyResult.endTime).toBeNull()
    expect(emptyResult.listType).toBeNull()
  })

  it("handles direct playlist URLs", () => {
    const result = parseYoutubeUrl(
      "https://www.youtube.com/playlist?list=PLURsDaOr8hWUWIIHnLycw1ObNaYrp0z4b",
    )

    expect(result.videoId).toBeNull()
    expect(result.startTime).toBeNull()
    expect(result.endTime).toBeNull()
    expect(result.listType).toBe("playlist")
    expect(result.list).toBeTruthy()
  })

  it("handles youtu.be URLs with playlist parameters", () => {
    const result = parseYoutubeUrl(
      "https://youtu.be/D28WdFvqwNY?list=PLURsDaOr8hWUWIIHnLycw1ObNaYrp0z4b",
    )

    expect(result.videoId).toBe("D28WdFvqwNY")
    expect(result.startTime).toBeNull()
    expect(result.endTime).toBeNull()
    expect(result.listType).toBe("playlist")
    expect(result.list).toBeTruthy()
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
      "https://www.youtube-nocookie.com/embed/D28WdFvqwNY?listType=playlist&list=PLURsDaOr8hWUWIIHnLycw1ObNaYrp0z4b&rel=0&modestbranding=1&enablejsapi=1",
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
      "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0&modestbranding=1&enablejsapi=1",
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
      "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?start=30&rel=0&modestbranding=1&enablejsapi=1",
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
      "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?start=30&end=60&rel=0&modestbranding=1&enablejsapi=1",
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
      "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?listType=playlist&list=PLC77007E23FF423C6&rel=0&modestbranding=1&enablejsapi=1",
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
      "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0&modestbranding=1&enablejsapi=1",
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
      "https://www.youtube-nocookie.com/embed/videoseries?listType=playlist&list=PLC77007E23FF423C6&rel=0&modestbranding=1&enablejsapi=1",
    )
  })

  it("handles video ID with playlist parameters correctly", () => {
    const params: YouTubeVideoParams = {
      videoId: "dQw4w9WgXcQ",
      startTime: "30",
      endTime: "60",
      listType: "playlist",
      list: "PLC77007E23FF423C6",
      embedOptions: {},
    }

    // The current implementation includes the video ID and time parameters
    expect(buildYoutubeEmbedUrl(params)).toContain("dQw4w9WgXcQ")
    expect(buildYoutubeEmbedUrl(params)).toContain("start=30")
    expect(buildYoutubeEmbedUrl(params)).toContain("end=60")
    expect(buildYoutubeEmbedUrl(params)).toContain("listType=playlist")
    expect(buildYoutubeEmbedUrl(params)).toContain("list=PLC77007E23FF423C6")
  })
})

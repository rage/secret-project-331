import { css } from "@emotion/css"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"

import { EmbedAttributes } from "../../../../../../types/GutenbergBlockAttributes"
import aspectRatioFromClassName from "../../../../../utils/aspectRatioFromClassName"
import { sanitizeCourseMaterialHtml } from "../../../../../utils/sanitizeCourseMaterialHtml"

import BreakFromCentered from "@/shared-module/common/components/Centering/BreakFromCentered"
import { baseTheme } from "@/shared-module/common/styles/theme"

const YOUTUBE_EMBED_BASE_URL = "https://www.youtube-nocookie.com/embed/"
const YOUTUBE_PLAYLIST_TYPE = "playlist"
const YOUTUBE_VIDEOSERIES_ID = "videoseries"
const YOUTUBE_PARAM_START = "start"
const YOUTUBE_PARAM_END = "end"
const YOUTUBE_PARAM_LIST_TYPE = "listType"
const YOUTUBE_PARAM_LIST = "list"
const YOUTUBE_PARAM_REL = "rel"
const YOUTUBE_PARAM_MODESTBRANDING = "modestbranding"
const YOUTUBE_PARAM_ENABLEJSAPI = "enablejsapi"

const YOUTUBE_EVENT_LISTENING = "listening"
const YOUTUBE_EVENT_ONREADY = "onReady"
const YOUTUBE_EVENT_INITIAL_DELIVERY = "initialDelivery"
const YOUTUBE_EVENT_ONSTATE_CHANGE = "onStateChange"

// YouTube player states
const YT_PLAYER_STATE = {
  UNSTARTED: -1,
  ENDED: 0,
  PLAYING: 1,
  PAUSED: 2,
  BUFFERING: 3,
  CUED: 5,
}

/**
 * YouTube video parameters
 */
export interface YouTubeVideoParams {
  videoId: string | null
  startTime: string | null
  endTime: string | null
  listType?: string | null
  list?: string | null
  embedOptions?: YouTubeEmbedOptions
}

/**
 * YouTube embed options
 */
export interface YouTubeEmbedOptions {
  rel?: string | number | boolean
  controls?: string | number | boolean
  modestbranding?: string | number | boolean
  autoplay?: string | number | boolean
  loop?: string | number | boolean
  cc_load_policy?: string | number | boolean
  iv_load_policy?: string | number | boolean
  fs?: string | number | boolean
  color?: string
  disablekb?: string | number | boolean
  enablejsapi?: string | number | boolean
  hl?: string
  playsinline?: string | number | boolean
  origin?: string
  widget_referrer?: string
  [key: string]: string | number | boolean | undefined
}

/**
 * Common YouTube player parameters that can be extracted from URLs
 */
const COMMON_OPTIONS = [
  "rel",
  "controls",
  "modestbranding",
  "autoplay",
  "loop",
  "cc_load_policy",
  "iv_load_policy",
  "fs",
  "color",
  "disablekb",
  "enablejsapi",
  "hl",
  "playsinline",
  "origin",
  "widget_referrer",
]

/**
 * Parses YouTube URLs and returns video parameters.
 */
export function parseYoutubeUrl(url: string): YouTubeVideoParams {
  const result: YouTubeVideoParams = {
    videoId: null,
    startTime: null,
    endTime: null,
    listType: null,
    embedOptions: {},
  }

  if (!url) {
    return result
  }

  if (!url.startsWith("http")) {
    return result
  }

  try {
    const parsedUrl = new URL(url)

    COMMON_OPTIONS.forEach((option) => {
      const value = parsedUrl.searchParams.get(option)
      if (value !== null) {
        result.embedOptions![option] = value
      }
    })

    if (parsedUrl.hostname === "www.youtube.com" || parsedUrl.hostname === "youtube.com") {
      if (parsedUrl.pathname === "/watch" || parsedUrl.pathname.startsWith("/watch/")) {
        const videoId = parsedUrl.searchParams.get("v")
        result.videoId = videoId !== "" ? videoId : null
      } else if (parsedUrl.pathname.startsWith("/embed/")) {
        const pathParts = parsedUrl.pathname.split("/embed/")
        result.videoId = pathParts.length > 1 && pathParts[1] !== "" ? pathParts[1] : null
      } else if (parsedUrl.pathname === "/playlist") {
        result.videoId = null
        result.listType = YOUTUBE_PLAYLIST_TYPE
      }
    } else if (parsedUrl.hostname === "youtu.be") {
      const pathId = parsedUrl.pathname.substring(1)
      result.videoId = pathId !== "" ? pathId : null
    }

    const startTime =
      parsedUrl.searchParams.get("t") ||
      parsedUrl.searchParams.get("start") ||
      parsedUrl.searchParams.get("time_continue")
    result.startTime = startTime || null

    const endTime = parsedUrl.searchParams.get("end")
    result.endTime = endTime || null

    // Get list parameter
    const list = parsedUrl.searchParams.get("list")
    if (list) {
      result.list = list
      // Only set listType to playlist if we have a list parameter and listType isn't already set
      if (!result.listType) {
        result.listType = YOUTUBE_PLAYLIST_TYPE
      }
    }

    // Check for explicit listType parameter
    const listTypeParam = parsedUrl.searchParams.get(YOUTUBE_PARAM_LIST_TYPE)
    if (listTypeParam) {
      result.listType = listTypeParam
    }
  } catch (_error) {
    // Return default result for invalid URLs
  }

  return result
}

/**
 * Parses time parameter from YouTube URL into seconds
 */
export function parseTimeParameter(time: string): number {
  if (!time) {
    return 0
  }

  if (!isNaN(Number(time))) {
    return Number(time)
  }

  let seconds = 0

  const hoursMatch = time.match(/(\d+)h/)
  if (hoursMatch) {
    seconds += parseInt(hoursMatch[1], 10) * 3600
  }

  const minutesMatch = time.match(/(\d+)m/)
  if (minutesMatch) {
    seconds += parseInt(minutesMatch[1], 10) * 60
  }

  const secondsMatch = time.match(/(\d+)s/)
  if (secondsMatch) {
    seconds += parseInt(secondsMatch[1], 10)
  }

  return seconds
}

/**
 * Builds a YouTube embed URL with the correct parameters
 */
export function buildYoutubeEmbedUrl(params: YouTubeVideoParams): string {
  const { videoId, startTime, endTime, listType, list, embedOptions = {} } = params

  const isPlaylistEmbed = listType && list
  const isPlaylistOnly = isPlaylistEmbed && !videoId

  const baseVideoId = isPlaylistOnly ? YOUTUBE_VIDEOSERIES_ID : videoId || ""

  let embedUrl = `${YOUTUBE_EMBED_BASE_URL}${baseVideoId}`
  const queryParams: string[] = []

  const startSeconds = startTime && !isPlaylistOnly ? parseTimeParameter(startTime) : 0
  if (startSeconds > 0) {
    queryParams.push(`${YOUTUBE_PARAM_START}=${startSeconds}`)
  }

  const endSeconds = endTime && !isPlaylistOnly ? parseTimeParameter(endTime) : 0
  if (endSeconds > 0) {
    queryParams.push(`${YOUTUBE_PARAM_END}=${endSeconds}`)
  }

  if (isPlaylistEmbed) {
    queryParams.push(`${YOUTUBE_PARAM_LIST_TYPE}=${listType}`)
    queryParams.push(`${YOUTUBE_PARAM_LIST}=${list}`)
  }

  queryParams.push(`${YOUTUBE_PARAM_REL}=0`)
  queryParams.push(`${YOUTUBE_PARAM_MODESTBRANDING}=1`)
  queryParams.push(`${YOUTUBE_PARAM_ENABLEJSAPI}=1`)

  Object.entries(embedOptions).forEach(([key, value]) => {
    queryParams.push(`${key}=${value}`)
  })

  if (queryParams.length > 0) {
    embedUrl += `?${queryParams.join("&")}`
  }

  return embedUrl
}

export const YoutubeEmbedBlock: React.FC<EmbedAttributes> = (props) => {
  const { t } = useTranslation()
  const { url, className, caption } = props
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [_playerState, setPlayerState] = useState<number | null>(null)
  const [isPlayerReady, setIsPlayerReady] = useState(false)

  const videoParams = useMemo(() => parseYoutubeUrl(url || ""), [url])
  const embedUrl = useMemo(() => buildYoutubeEmbedUrl(videoParams), [videoParams])

  const isPlaylistEmbed = videoParams.listType && videoParams.list
  const hasValidVideo =
    (videoParams.videoId !== null && videoParams.videoId !== "") || isPlaylistEmbed

  const postMessageToYouTube = useCallback((message: Record<string, unknown>) => {
    if (!iframeRef.current || !iframeRef.current.contentWindow) {
      return
    }

    try {
      iframeRef.current.contentWindow.postMessage(JSON.stringify(message), "*")
    } catch (error) {
      console.error("Error posting message to YouTube player:", error)
    }
  }, [])

  useEffect(() => {
    if (!hasValidVideo) {
      return
    }

    // Abort controller to cancel all listeners connected to this controller
    const abortController = new AbortController()

    window.addEventListener(
      "message",
      (event: MessageEvent) => {
        try {
          if (!iframeRef.current) {
            return
          }

          const iframeWindow = iframeRef.current.contentWindow

          // Skip if the message isn't from our iframe
          if (event.source !== iframeWindow) {
            return
          }

          const data = typeof event.data === "string" ? JSON.parse(event.data) : event.data

          if (data.event === YOUTUBE_EVENT_ONSTATE_CHANGE) {
            setPlayerState(data.info)

            if (data.info === YT_PLAYER_STATE.PLAYING) {
              setIsPlayerReady(true)
            }
          }

          if (
            data.event === YOUTUBE_EVENT_INITIAL_DELIVERY ||
            data.event === YOUTUBE_EVENT_ONREADY
          ) {
            setIsPlayerReady(true)
            postMessageToYouTube({ event: YOUTUBE_EVENT_LISTENING })
          }
        } catch (_error) {
          // Ignore parsing errors from unrelated messages
        }
      },
      { signal: abortController.signal },
    )

    const initializePlayer = () => {
      if (iframeRef.current && iframeRef.current.contentWindow) {
        postMessageToYouTube({ event: YOUTUBE_EVENT_LISTENING })
      }
    }

    if (iframeRef.current) {
      iframeRef.current.onload = initializePlayer

      if (iframeRef.current.contentDocument?.readyState === "complete") {
        initializePlayer()
      }
    }

    // Cleanup function that cancels all listeners connected to this controller
    return () => {
      abortController.abort()
    }
  }, [hasValidVideo, postMessageToYouTube])

  return (
    <BreakFromCentered sidebar={false}>
      <figure
        className={css`
          width: 100%;
          max-width: 1000px;
          margin: 4rem auto;
        `}
      >
        {!hasValidVideo && (
          <div
            className={css`
              display: flex;
              justify-content: center;
              align-items: center;
              background-color: ${baseTheme.colors.gray[100]};
              aspect-ratio: ${aspectRatioFromClassName(className) || "16/9"};
              color: ${baseTheme.colors.gray[600]};
              font-size: ${baseTheme.fontSizes[1]}px;
              padding: 1rem;
              text-align: center;
            `}
          >
            {t("youtube-embed-error")}
          </div>
        )}

        {hasValidVideo && (
          <div
            className={css`
              position: relative;
              width: 100%;
              aspect-ratio: ${aspectRatioFromClassName(className) || "16/9"};
            `}
          >
            {!isPlayerReady && (
              <div
                className={css`
                  position: absolute;
                  top: 0;
                  left: 0;
                  width: 100%;
                  height: 100%;
                  display: flex;
                  justify-content: center;
                  align-items: center;
                  background-color: ${baseTheme.colors.gray[700]};
                  color: ${baseTheme.colors.gray[300]};
                  transition: opacity 0.3s ease;
                  z-index: 1;
                `}
              >
                <svg
                  width="68"
                  height="48"
                  viewBox="0 0 68 48"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M66.52 7.74C65.7 4.78 63.34 2.42 60.38 1.6C55.08 0 34 0 34 0C34 0 12.92 0 7.62 1.6C4.66 2.42 2.3 4.78 1.48 7.74C0 13.52 0 25 0 25C0 25 0 36.48 1.48 42.26C2.3 45.22 4.66 47.58 7.62 48.4C12.92 50 34 50 34 50C34 50 55.08 50 60.38 48.4C63.34 47.58 65.7 45.22 66.52 42.26C68 36.48 68 25 68 25C68 25 68 13.52 66.52 7.74Z"
                    fill="#FF0000"
                    fillOpacity="0.8"
                  />
                  <path d="M27 36L45 25L27 14V36Z" fill="white" />
                </svg>
              </div>
            )}

            <iframe
              ref={iframeRef}
              className={css`
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                border: 0;
                opacity: ${isPlayerReady ? 1 : 0};
                transition: opacity 0.3s ease;
              `}
              src={embedUrl}
              title={t("title-youtube-video-player")}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-presentation"
              allowFullScreen
              data-testid="youtube-player-iframe"
            />
          </div>
        )}

        {caption && (
          <figcaption
            className={css`
              text-align: center;
              font-size: ${baseTheme.fontSizes[0]}px;
              margin-top: 0.5em;
              margin-bottom: 1em;
              color: ${baseTheme.colors.gray[400]};
            `}
            dangerouslySetInnerHTML={{ __html: sanitizeCourseMaterialHtml(caption) }}
          ></figcaption>
        )}
      </figure>
    </BreakFromCentered>
  )
}

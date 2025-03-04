import { css } from "@emotion/css"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { useInView } from "react-intersection-observer"

import { EmbedAttributes } from "../../../../../../types/GutenbergBlockAttributes"
import aspectRatioFromClassName from "../../../../../utils/aspectRatioFromClassName"
import { sanitizeCourseMaterialHtml } from "../../../../../utils/sanitizeCourseMaterialHtml"

import BreakFromCentered from "@/shared-module/common/components/Centering/BreakFromCentered"
import { baseTheme } from "@/shared-module/common/styles/theme"

/**
 * Technical constants used for YouTube API integration
 * These are not user-facing strings and should not be translated
 */
const YOUTUBE_EMBED_BASE_URL = "https://www.youtube-nocookie.com/embed/"
const YOUTUBE_PLAYLIST_PATH = "/playlist"
const YOUTUBE_PLAYLIST_TYPE = "playlist"
const YOUTUBE_VIDEOSERIES_ID = "videoseries"
const YOUTUBE_PARAM_START = "start"
const YOUTUBE_PARAM_END = "end"
const YOUTUBE_PARAM_LIST_TYPE = "listType"
const YOUTUBE_PARAM_LIST = "list"
const YOUTUBE_PARAM_REL = "rel"
const YOUTUBE_PARAM_MODESTBRANDING = "modestbranding"
const YOUTUBE_PARAM_ENABLEJSAPI = "enablejsapi"

// YouTube API message constants
const YOUTUBE_EVENT_COMMAND = "command"
const YOUTUBE_EVENT_LISTENING = "listening"
const YOUTUBE_EVENT_ONREADY = "onReady"
const YOUTUBE_EVENT_INITIAL_DELIVERY = "initialDelivery"
const YOUTUBE_EVENT_ONSTATE_CHANGE = "onStateChange"
const YOUTUBE_FUNC_PLAY_VIDEO = "playVideo"
const YOUTUBE_FUNC_PAUSE_VIDEO = "pauseVideo"
const YOUTUBE_FUNC_STOP_VIDEO = "stopVideo"
const YOUTUBE_FUNC_SEEK_TO = "seekTo"

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
 * Interface for YouTube video parameters
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
 * Interface for YouTube embed options
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
 * These parameters control the player's appearance and behavior
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
 * Handles various YouTube URL formats and parameters including:
 * - youtube.com/watch
 * - youtu.be
 * - youtube.com/embed
 * - youtube.com/playlist
 * - Various query parameters including t, start, end, list, listType
 */
export function parseYoutubeUrl(url: string): YouTubeVideoParams {
  const result: YouTubeVideoParams = {
    videoId: null,
    startTime: null,
    endTime: null,
    embedOptions: {},
  }

  if (!url) {
    return result
  }

  if (!url.startsWith("http")) {
    return result
  }

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

  const list = parsedUrl.searchParams.get("list")
  if (list) {
    result.listType = list
  }

  // This should remain using the literal "playlist" string
  result.listType =
    parsedUrl.pathname === YOUTUBE_PLAYLIST_PATH
      ? YOUTUBE_PLAYLIST_TYPE
      : parsedUrl.searchParams.get(YOUTUBE_PARAM_LIST_TYPE) || YOUTUBE_PLAYLIST_TYPE

  return result
}

/**
 * Parses time parameter from YouTube URL (e.g., "5s", "1m30s") into seconds
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
  queryParams.push(`${YOUTUBE_PARAM_ENABLEJSAPI}=1`) // Always enable JS API for postMessage

  Object.entries(embedOptions).forEach(([key, value]) => {
    queryParams.push(`${key}=${value}`)
  })

  if (queryParams.length > 0) {
    embedUrl += `?${queryParams.join("&")}`
  }

  return embedUrl
}

/**
 * Interface for direct iframe control without YouTube API
 */
interface YouTubePlayerDirectAPI {
  play: () => void
  pause: () => void
  stop: () => void
  seekTo: (seconds: number) => void
  getPlayerState: () => number | null
}

export const YoutubeEmbedBlock: React.FC<EmbedAttributes> = (props) => {
  const { t } = useTranslation()
  const { url, className, caption } = props
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [playerState, setPlayerState] = useState<number | null>(null)
  const [isPlayerReady, setIsPlayerReady] = useState(false)

  const videoParams = useMemo(() => parseYoutubeUrl(url || ""), [url])
  const embedUrl = useMemo(() => buildYoutubeEmbedUrl(videoParams), [videoParams])

  const isPlaylistEmbed = videoParams.listType && videoParams.list
  const hasValidVideo =
    (videoParams.videoId !== null && videoParams.videoId !== "") || isPlaylistEmbed

  // Add intersection observer for lazy loading
  const { ref: containerRef, inView } = useInView({
    threshold: 0.1,
    triggerOnce: true,
  })

  // Send message to YouTube iframe
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

  // Create YouTube player control API
  const playerAPI = useMemo<YouTubePlayerDirectAPI>(
    () => ({
      play: () =>
        postMessageToYouTube({ event: YOUTUBE_EVENT_COMMAND, func: YOUTUBE_FUNC_PLAY_VIDEO }),
      pause: () =>
        postMessageToYouTube({ event: YOUTUBE_EVENT_COMMAND, func: YOUTUBE_FUNC_PAUSE_VIDEO }),
      stop: () =>
        postMessageToYouTube({ event: YOUTUBE_EVENT_COMMAND, func: YOUTUBE_FUNC_STOP_VIDEO }),
      seekTo: (seconds: number) =>
        postMessageToYouTube({
          event: YOUTUBE_EVENT_COMMAND,
          func: YOUTUBE_FUNC_SEEK_TO,
          args: [seconds, true],
        }),
      getPlayerState: () => playerState,
    }),
    [postMessageToYouTube, playerState],
  )

  // Listen for messages from YouTube iframe
  useEffect(() => {
    if (!hasValidVideo || !inView) {
      return
    }

    const handleMessage = (event: MessageEvent) => {
      try {
        // Parse message data
        const data = typeof event.data === "string" ? JSON.parse(event.data) : event.data

        // Handle player state changes
        if (data.event === YOUTUBE_EVENT_ONSTATE_CHANGE) {
          setPlayerState(data.info)

          // If state changed to playing, player is definitely ready
          if (data.info === YT_PLAYER_STATE.PLAYING) {
            setIsPlayerReady(true)
          }
        }

        // Handle API ready events
        if (data.event === YOUTUBE_EVENT_INITIAL_DELIVERY || data.event === YOUTUBE_EVENT_ONREADY) {
          setIsPlayerReady(true)

          // Start listening for events
          postMessageToYouTube({ event: YOUTUBE_EVENT_LISTENING })
        }
      } catch (_error) {
        // Ignore parsing errors from unrelated messages
      }
    }

    // Add message event listener
    window.addEventListener("message", handleMessage)

    // Tell iframe we're listening when iframe is loaded
    const initializePlayer = () => {
      if (iframeRef.current && iframeRef.current.contentWindow) {
        // Start listening for events
        postMessageToYouTube({ event: YOUTUBE_EVENT_LISTENING })
      }
    }

    // Set up onload handler for iframe
    if (iframeRef.current) {
      iframeRef.current.onload = initializePlayer

      // If iframe is already loaded, initialize player immediately
      if (iframeRef.current.contentDocument?.readyState === "complete") {
        initializePlayer()
      }
    }

    return () => {
      // Clean up event listener
      window.removeEventListener("message", handleMessage)
    }
  }, [hasValidVideo, inView, postMessageToYouTube])

  // Expose player API to window
  useEffect(() => {
    if (!isPlayerReady) {
      return
    }

    // Create a unique ID based on video ID
    const instanceId = videoParams.videoId || videoParams.list || Date.now().toString()

    // Initialize global object if needed
    if (window && !window.YouTubePlayerInstances) {
      window.YouTubePlayerInstances = {}
    }

    // Expose API to window
    if (window && window.YouTubePlayerInstances) {
      window.YouTubePlayerInstances[instanceId] = playerAPI

      return () => {
        if (window.YouTubePlayerInstances) {
          delete window.YouTubePlayerInstances[instanceId]
        }
      }
    }
  }, [isPlayerReady, playerAPI, videoParams])

  return (
    <BreakFromCentered sidebar={false}>
      <figure
        ref={containerRef}
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
            {/* Placeholder with loading indicator */}
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
                {/* YouTube-style play button */}
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

            {/* YouTube iframe (only create it when in view) */}
            {inView && (
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
                allowFullScreen
                data-testid="youtube-player-iframe"
              />
            )}
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

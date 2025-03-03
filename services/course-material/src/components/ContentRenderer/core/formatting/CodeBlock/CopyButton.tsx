import { css } from "@emotion/css"
import { createPopper, Instance as PopperInstance } from "@popperjs/core"
import { CheckCircle, XmarkCircle } from "@vectopus/atlas-icons-react"
import { useCallback, useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { animated, SpringValue, useTransition } from "react-spring"

import { useCopyToClipboard } from "./utils"

import CopyIcon from "@/img/copy.svg"
import { baseTheme } from "@/shared-module/common/styles"

const COPY_STATUS = {
  DEFAULT: "default",
  SUCCESS: "success",
  ERROR: "error",
} as const

type CopyStatus = (typeof COPY_STATUS)[keyof typeof COPY_STATUS]

const ICON_COLORS = {
  DEFAULT: baseTheme.colors.primary[100],
  SUCCESS: "#5cc89b",
  ERROR: baseTheme.colors.red[300],
} as const

interface CopyButtonProps {
  content: string
}

const buttonStyles = css`
  position: absolute;
  top: 24px;
  right: 24px;
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  transition:
    transform 0.2s,
    background-color 0.2s,
    color 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  color: ${baseTheme.colors.primary[100]};
  &[data-status="success"] {
    color: ${ICON_COLORS.SUCCESS};
  }
  &[data-status="error"] {
    color: ${ICON_COLORS.ERROR};
  }
  &:hover:not([data-status="default"]) {
    background-color: ${baseTheme.colors.gray[600]};
  }
  &:hover[data-status="default"] {
    transform: scale(1.1);
    background-color: ${baseTheme.colors.gray[600]};
  }
`

const tooltipStyles = css`
  visibility: hidden;
  opacity: 0;
  background-color: ${baseTheme.colors.gray[700]};
  color: ${baseTheme.colors.primary[100]};
  text-align: center;
  border-radius: 4px;
  padding: 4px 8px;
  position: absolute;
  z-index: 1;
  font-size: 12px;
  pointer-events: none;
  white-space: nowrap;
  transition:
    visibility 0s,
    opacity 0.2s;
  &[data-show="true"] {
    visibility: visible;
    opacity: 1;
  }
`

const iconWrapperStyles = css`
  position: relative;
  width: 24px;
  height: 24px;
`

const iconStyles = css`
  width: 24px;
  height: 24px;
  color: currentColor;
`

const AnimatedDiv = animated.div as React.FC<{
  style: {
    opacity: SpringValue<number>
    transform: SpringValue<string>
  }
  children: React.ReactNode
}>

/**
 * Button component that copies text to clipboard.
 * Shows success/error state for 2 seconds after copy attempt.
 */
export const CopyButton: React.FC<CopyButtonProps> = ({ content }) => {
  const { t } = useTranslation()
  const [copyStatus, setCopyStatus] = useState<CopyStatus>(COPY_STATUS.DEFAULT)
  const [showTooltip, setShowTooltip] = useState(false)
  const copyToClipboard = useCopyToClipboard(content)

  const buttonRef = useRef<HTMLButtonElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const popperInstanceRef = useRef<PopperInstance | null>(null)

  useEffect(() => {
    if (buttonRef.current && tooltipRef.current) {
      popperInstanceRef.current = createPopper(buttonRef.current, tooltipRef.current, {
        placement: "top",
        modifiers: [
          {
            name: "offset",
            options: {
              offset: [0, 12],
            },
          },
          {
            name: "preventOverflow",
            options: {
              padding: 8,
            },
          },
        ],
      })
    }

    return () => {
      if (popperInstanceRef.current) {
        popperInstanceRef.current.destroy()
        popperInstanceRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    if (popperInstanceRef.current) {
      popperInstanceRef.current.update()
    }
  }, [showTooltip, copyStatus])

  useEffect(() => {
    if (copyStatus !== COPY_STATUS.DEFAULT) {
      setShowTooltip(true)
      const timer = setTimeout(() => {
        setCopyStatus(COPY_STATUS.DEFAULT)
        setShowTooltip(false)
      }, 2000)
      return () => clearTimeout(timer)
    }
  }, [copyStatus])

  const handleCopy = useCallback(async () => {
    const success = await copyToClipboard()
    setCopyStatus(success ? COPY_STATUS.SUCCESS : COPY_STATUS.ERROR)
  }, [copyToClipboard])

  const handleMouseEnter = useCallback(() => {
    setShowTooltip(true)
  }, [])

  const handleMouseLeave = useCallback(() => {
    if (copyStatus === COPY_STATUS.DEFAULT) {
      setShowTooltip(false)
    }
  }, [copyStatus])

  const transitions = useTransition(copyStatus, {
    from: { opacity: 0, transform: "scale(0.5)", position: "absolute" },
    enter: { opacity: 1, transform: "scale(1.1)", position: "absolute" },
    leave: { opacity: 0, transform: "scale(0.5)", position: "absolute" },
    config: { tension: 300, friction: 20 },
  })

  return (
    <button
      ref={buttonRef}
      onClick={handleCopy}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={buttonStyles}
      data-status={copyStatus}
      aria-label={
        copyStatus === COPY_STATUS.SUCCESS
          ? t("copied")
          : copyStatus === COPY_STATUS.ERROR
            ? t("copying-failed")
            : t("copy-to-clipboard")
      }
    >
      <div className={iconWrapperStyles}>
        {transitions((style, item) => {
          const IconComponent =
            item === COPY_STATUS.SUCCESS ? (
              <CheckCircle size={24} color={ICON_COLORS.SUCCESS} />
            ) : item === COPY_STATUS.ERROR ? (
              <XmarkCircle size={24} color={ICON_COLORS.ERROR} />
            ) : (
              <CopyIcon className={iconStyles} />
            )
          // eslint-disable-next-line react/forbid-component-props
          return <AnimatedDiv style={style}>{IconComponent}</AnimatedDiv>
        })}
      </div>
      <div ref={tooltipRef} className={tooltipStyles} data-show={showTooltip}>
        {copyStatus === COPY_STATUS.SUCCESS
          ? t("copied")
          : copyStatus === COPY_STATUS.ERROR
            ? t("copying-failed")
            : t("copy-to-clipboard")}
      </div>
    </button>
  )
}

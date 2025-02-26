import { css } from "@emotion/css"
import { CheckCircle, PlusClipboard, XmarkCircle } from "@vectopus/atlas-icons-react"
import { useCallback, useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { animated, SpringValue, useTransition } from "react-spring"

const COPY_STATUS = {
  DEFAULT: "default",
  SUCCESS: "success",
  ERROR: "error",
} as const

type CopyStatus = (typeof COPY_STATUS)[keyof typeof COPY_STATUS]

const ICON_COLORS = {
  DEFAULT: "#fff",
  SUCCESS: "#4ade80",
  ERROR: "#ff6b6b",
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
    background-color 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  &:hover:not([data-status="default"]) {
    background-color: rgba(0, 0, 0, 0.1);
  }
  &:hover[data-status="default"] {
    transform: scale(1.1);
    background-color: rgba(0, 0, 0, 0.1);
  }
`

const tooltipStyles = css`
  visibility: hidden;
  opacity: 0;
  background-color: #333;
  color: #fff;
  text-align: center;
  border-radius: 4px;
  padding: 4px 8px;
  position: absolute;
  z-index: 1;
  top: -40px;
  left: 50%;
  transform: translateX(-50%);
  white-space: nowrap;
  font-size: 12px;
  pointer-events: none;
  transition:
    visibility 0s,
    opacity 0.2s;
  &::after {
    content: "";
    position: absolute;
    bottom: -5px;
    left: 50%;
    margin-left: -5px;
    border-width: 5px;
    border-style: solid;
    border-color: #333 transparent transparent transparent;
  }
  button:hover &,
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

const AnimatedDiv = animated.div as React.FC<{
  style: {
    opacity: SpringValue<number>
    transform: SpringValue<string>
  }
  children: React.ReactNode
}>

/**
 * Copies text to clipboard using legacy execCommand method.
 * Used as fallback when Clipboard API is unavailable.
 */
const copyWithFallback = (content: string) => {
  const textArea = document.createElement("textarea")
  textArea.value = content
  document.body.appendChild(textArea)
  textArea.select()
  // eslint-disable-next-line i18next/no-literal-string
  const successful = document.execCommand("copy")
  document.body.removeChild(textArea)
  if (!successful) {
    throw new Error("Copy failed")
  }
}

/**
 * Button component that copies text to clipboard.
 * Shows success/error state for 10 seconds after copy attempt.
 */
export const CopyButton: React.FC<CopyButtonProps> = ({ content }) => {
  const { t } = useTranslation()
  const [copyStatus, setCopyStatus] = useState<CopyStatus>(COPY_STATUS.DEFAULT)
  const [showTooltip, setShowTooltip] = useState(false)

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
    try {
      if (navigator.clipboard) {
        try {
          await navigator.clipboard.writeText(content)
        } catch {
          // If clipboard API fails, try fallback method
          copyWithFallback(content)
        }
      } else {
        // Fallback method for older browsers AND for non https sites
        copyWithFallback(content)
      }
      setCopyStatus(COPY_STATUS.SUCCESS)
    } catch (error) {
      console.error("Copying to clipboard failed:", error)
      setCopyStatus(COPY_STATUS.ERROR)
    }
  }, [content])

  const transitions = useTransition(copyStatus, {
    from: { opacity: 0, transform: "scale(0.5)", position: "absolute" },
    enter: { opacity: 1, transform: "scale(1.1)", position: "absolute" },
    leave: { opacity: 0, transform: "scale(0.5)", position: "absolute" },
    config: { tension: 300, friction: 20 },
  })

  return (
    <button onClick={handleCopy} className={buttonStyles} data-status={copyStatus}>
      <div className={iconWrapperStyles}>
        {transitions((style, item) => {
          const Icon =
            item === COPY_STATUS.SUCCESS
              ? CheckCircle
              : item === COPY_STATUS.ERROR
                ? XmarkCircle
                : PlusClipboard
          return (
            // eslint-disable-next-line react/forbid-component-props
            <AnimatedDiv style={style}>
              <Icon
                size={24}
                color={
                  item === COPY_STATUS.SUCCESS
                    ? ICON_COLORS.SUCCESS
                    : item === COPY_STATUS.ERROR
                      ? ICON_COLORS.ERROR
                      : ICON_COLORS.DEFAULT
                }
              />
            </AnimatedDiv>
          )
        })}
      </div>
      <span className={tooltipStyles} data-show={showTooltip}>
        {copyStatus === COPY_STATUS.SUCCESS
          ? t("copied")
          : copyStatus === COPY_STATUS.ERROR
            ? t("copying-failed")
            : t("copy-to-clipboard")}
      </span>
    </button>
  )
}

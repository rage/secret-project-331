"use client"
import { css } from "@emotion/css"
import { ReplayArrowLeftRight } from "@vectopus/atlas-icons-react"
import React from "react"
import { useButton } from "react-aria"
import { useTranslation } from "react-i18next"

import { baseTheme } from "@/shared-module/common/styles"

interface FlipButtonProps {
  onPress: () => void
  ariaLabel: string
  ref?: React.Ref<HTMLButtonElement>
}

const FlipButton: React.FC<FlipButtonProps> = ({ onPress, ariaLabel, ref }) => {
  const { t } = useTranslation()
  const internalRef = React.useRef<HTMLButtonElement>(null)
  const buttonRef = (ref as React.RefObject<HTMLButtonElement>) || internalRef
  const { buttonProps, isPressed } = useButton(
    {
      onPress,
    },
    buttonRef as React.RefObject<HTMLButtonElement>,
  )

  return (
    <button
      ref={buttonRef}
      {...buttonProps}
      className={css`
        position: absolute;
        bottom: 10px;
        right: 10px;
        z-index: 1;
        backface-visibility: hidden;
        border-radius: 10px;
        width: 54px;
        height: 42px;
        background: ${baseTheme.colors.clear[100]};
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        color: ${baseTheme.colors.gray[700]};
        border: 2px solid ${baseTheme.colors.gray[600]};
        cursor: pointer;
        padding: 0;
        font-size: 9px;

        &::after {
          content: "";
          position: absolute;
          left: -1000px;
          top: -1000px;
          right: -10px;
          bottom: -10px;
          z-index: -1;
        }

        &:focus {
          outline: none;
        }

        &:focus-visible {
          outline: 2px solid ${baseTheme.colors.blue[500]};
          outline-offset: 2px;
        }

        ${isPressed &&
        `
          transform: scale(0.98);
        `}
      `}
      aria-label={ariaLabel}
    >
      <div>{t("button-text-flip")}</div>
      <ReplayArrowLeftRight size={16} />
    </button>
  )
}

export default FlipButton

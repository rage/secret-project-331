import { css } from "@emotion/css"
import { useEffect, useRef, useState } from "react"

type Corner = "TL" | "TR" | "BR" | "BL"

const FLIP_ANIMATION_MS = 1800

// Ten distinct flip animations to choose from at runtime
const flipAnimationClasses = [
  // A: Y-axis flip with depth
  css`
    will-change: transform;
    transform-origin: center center;
    transform-style: preserve-3d;
    animation: heroFlipA ${FLIP_ANIMATION_MS}ms cubic-bezier(0.4, 0, 0.2, 1) both;
    @keyframes heroFlipA {
      0% {
        transform: perspective(1200px) translate3d(0, 0, 0) rotateY(0deg) scale(1);
      }
      40% {
        transform: perspective(1200px) translate3d(0, -12px, 70px) rotateY(200deg) scale(1.06);
      }
      100% {
        transform: perspective(1200px) translate3d(0, 0, 0) rotateY(360deg) scale(1);
      }
    }
  `,
  // B: X-axis flip with slight Y wobble
  css`
    will-change: transform;
    transform-origin: center center;
    transform-style: preserve-3d;
    animation: heroFlipB ${FLIP_ANIMATION_MS}ms cubic-bezier(0.4, 0, 0.2, 1) both;
    @keyframes heroFlipB {
      0% {
        transform: perspective(1200px) rotateX(0deg) rotateY(0deg) translate3d(0, 0, 0) scale(1);
      }
      50% {
        transform: perspective(1200px) rotateX(180deg) rotateY(6deg) translate3d(0, -10px, 60px)
          scale(1.05);
      }
      100% {
        transform: perspective(1200px) rotateX(360deg) rotateY(0deg) translate3d(0, 0, 0) scale(1);
      }
    }
  `,
  // C: Barrel roll (Z) with pulse
  css`
    will-change: transform;
    transform-origin: center center;
    animation: heroFlipC ${FLIP_ANIMATION_MS}ms cubic-bezier(0.4, 0, 0.2, 1) both;
    @keyframes heroFlipC {
      0% {
        transform: translate3d(0, 0, 0) rotateZ(0deg) scale(1);
      }
      50% {
        transform: translate3d(0, -8px, 0) rotateZ(180deg) scale(1.08);
      }
      100% {
        transform: translate3d(0, 0, 0) rotateZ(360deg) scale(1);
      }
    }
  `,
  // D: Y flip with overshoot and settle
  css`
    will-change: transform;
    transform-origin: center center;
    transform-style: preserve-3d;
    animation: heroFlipD ${FLIP_ANIMATION_MS}ms cubic-bezier(0.34, 1.56, 0.64, 1) both;
    @keyframes heroFlipD {
      0% {
        transform: perspective(1200px) rotateY(0deg) scale(1);
      }
      60% {
        transform: perspective(1200px) rotateY(390deg) translate3d(0, -10px, 60px) scale(1.06);
      }
      100% {
        transform: perspective(1200px) rotateY(360deg) translate3d(0, 0, 0) scale(1);
      }
    }
  `,
  // E: Quick tilt then full Y flip
  css`
    will-change: transform;
    transform-origin: center center;
    transform-style: preserve-3d;
    animation: heroFlipE ${FLIP_ANIMATION_MS}ms cubic-bezier(0.4, 0, 0.2, 1) both;
    @keyframes heroFlipE {
      0% {
        transform: perspective(1200px) rotateY(0deg) rotateX(0deg) scale(1);
      }
      20% {
        transform: perspective(1200px) rotateY(30deg) rotateX(-6deg) translate3d(0, -6px, 30px)
          scale(1.03);
      }
      100% {
        transform: perspective(1200px) rotateY(360deg) rotateX(0deg) translate3d(0, 0, 0) scale(1);
      }
    }
  `,
  // F: Diagonal axis spin (X + Y)
  css`
    will-change: transform;
    transform-origin: center center;
    transform-style: preserve-3d;
    animation: heroFlipF ${FLIP_ANIMATION_MS}ms cubic-bezier(0.4, 0, 0.2, 1) both;
    @keyframes heroFlipF {
      0% {
        transform: perspective(1200px) rotateX(0deg) rotateY(0deg) scale(1);
      }
      50% {
        transform: perspective(1200px) rotateX(180deg) rotateY(180deg) translate3d(0, -12px, 70px)
          scale(1.06);
      }
      100% {
        transform: perspective(1200px) rotateX(360deg) rotateY(360deg) scale(1);
      }
    }
  `,
  // G: Swinging Y flip (wobble)
  css`
    will-change: transform;
    transform-origin: center center;
    transform-style: preserve-3d;
    animation: heroFlipG ${FLIP_ANIMATION_MS}ms cubic-bezier(0.4, 0, 0.2, 1) both;
    @keyframes heroFlipG {
      0% {
        transform: perspective(1200px) rotateY(0deg) scale(1);
      }
      30% {
        transform: perspective(1200px) rotateY(200deg) translate3d(0, -8px, 40px) scale(1.04);
      }
      60% {
        transform: perspective(1200px) rotateY(150deg) translate3d(0, -6px, 30px) scale(1.03);
      }
      100% {
        transform: perspective(1200px) rotateY(360deg) translate3d(0, 0, 0) scale(1);
      }
    }
  `,
  // H: Backflip (X) with lift
  css`
    will-change: transform;
    transform-origin: center center;
    transform-style: preserve-3d;
    animation: heroFlipH ${FLIP_ANIMATION_MS}ms cubic-bezier(0.4, 0, 0.2, 1) both;
    @keyframes heroFlipH {
      0% {
        transform: perspective(1200px) rotateX(0deg) translate3d(0, 0, 0) scale(1);
      }
      50% {
        transform: perspective(1200px) rotateX(180deg) translate3d(0, -16px, 60px) scale(1.05);
      }
      100% {
        transform: perspective(1200px) rotateX(360deg) translate3d(0, 0, 0) scale(1);
      }
    }
  `,
  // I: 3D spin across all axes
  css`
    will-change: transform;
    transform-origin: center center;
    transform-style: preserve-3d;
    animation: heroFlipI ${FLIP_ANIMATION_MS}ms cubic-bezier(0.4, 0, 0.2, 1) both;
    @keyframes heroFlipI {
      0% {
        transform: perspective(1200px) rotateX(0deg) rotateY(0deg) rotateZ(0deg) scale(1);
      }
      50% {
        transform: perspective(1200px) rotateX(160deg) rotateY(120deg) rotateZ(20deg)
          translate3d(0, -10px, 50px) scale(1.05);
      }
      100% {
        transform: perspective(1200px) rotateX(360deg) rotateY(300deg) rotateZ(0deg) scale(1);
      }
    }
  `,
  // J: Minimal elegant Y flip
  css`
    will-change: transform;
    transform-origin: center center;
    transform-style: preserve-3d;
    animation: heroFlipJ ${FLIP_ANIMATION_MS}ms cubic-bezier(0.4, 0, 0.2, 1) both;
    @keyframes heroFlipJ {
      0% {
        transform: perspective(1200px) rotateY(0deg) scale(1);
      }
      50% {
        transform: perspective(1200px) rotateY(180deg) translate3d(0, -6px, 40px) scale(1.03);
      }
      100% {
        transform: perspective(1200px) rotateY(360deg) scale(1);
      }
    }
  `,
]

export interface CornerTapFlipReturn {
  containerRef: React.RefObject<HTMLDivElement | null>
  onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void
  onClick: (e: React.MouseEvent<HTMLDivElement>) => void
  flipClassName: string | undefined
}

/**
 * Detects taps in 4 corners in clockwise order (TL → TR → BR → BL) and exposes
 * a className to trigger a 3D flip animation on a target element.
 */
export const useCornerTapFlip = (): CornerTapFlipReturn => {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const resetTimerRef = useRef<number | null>(null)
  const lastPointerDownTimestampRef = useRef<number>(0)
  const [sequenceIndex, setSequenceIndex] = useState<number>(0)
  const [triggerFlip, setTriggerFlip] = useState<boolean>(false)
  const [flipIndex, setFlipIndex] = useState<number>(() => Math.floor(Math.random() * 10))

  useEffect(() => {
    return () => {
      if (resetTimerRef.current) {
        window.clearTimeout(resetTimerRef.current)
      }
    }
  }, [])

  const clamp = (value: number, min: number, max: number): number => {
    return Math.max(min, Math.min(max, value))
  }

  const handleDown = (clientX: number, clientY: number) => {
    if (!containerRef.current) {
      return
    }
    const rect = containerRef.current.getBoundingClientRect()
    const x = clientX - rect.left
    const y = clientY - rect.top

    // Enlarge the hit areas to make mouse interaction easier.
    const thresholdX = clamp(rect.width * 0.25, 80, 160)
    const thresholdY = clamp(rect.height * 0.25, 80, 160)

    let corner: Corner | null = null
    if (x <= thresholdX && y <= thresholdY) {
      corner = "TL"
    } else if (x >= rect.width - thresholdX && y <= thresholdY) {
      corner = "TR"
    } else if (x >= rect.width - thresholdX && y >= rect.height - thresholdY) {
      corner = "BR"
    } else if (x <= thresholdX && y >= rect.height - thresholdY) {
      corner = "BL"
    }

    if (!corner) {
      setSequenceIndex(0)
      return
    }

    const sequence: Corner[] = ["TL", "TR", "BR", "BL"]
    const expected = sequence[sequenceIndex]

    if (corner === expected) {
      const nextIndex = sequenceIndex + 1
      if (nextIndex === sequence.length) {
        setSequenceIndex(0)
        setFlipIndex(Math.floor(Math.random() * 10))
        setTriggerFlip(true)
        window.setTimeout(() => setTriggerFlip(false), FLIP_ANIMATION_MS + 100)
      } else {
        setSequenceIndex(nextIndex)
        if (resetTimerRef.current) {
          window.clearTimeout(resetTimerRef.current)
        }
        resetTimerRef.current = window.setTimeout(() => {
          setSequenceIndex(0)
        }, 2000)
      }
    } else {
      setSequenceIndex(corner === "TL" ? 1 : 0)
      if (resetTimerRef.current) {
        window.clearTimeout(resetTimerRef.current)
      }
      resetTimerRef.current = window.setTimeout(() => {
        setSequenceIndex(0)
      }, 2000)
    }
  }

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    lastPointerDownTimestampRef.current = e.timeStamp
    handleDown(e.clientX, e.clientY)
  }

  const onClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Avoid handling the same interaction twice (pointerdown followed by click)
    if (e.timeStamp - lastPointerDownTimestampRef.current < 350) {
      return
    }
    handleDown(e.clientX, e.clientY)
  }

  return {
    containerRef,
    onPointerDown,
    onClick,
    flipClassName: triggerFlip ? flipAnimationClasses[flipIndex] : undefined,
  }
}

export default useCornerTapFlip

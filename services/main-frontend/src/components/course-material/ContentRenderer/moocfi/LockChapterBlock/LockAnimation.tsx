"use client"

import { useCallback, useEffect, useMemo, useRef } from "react"
import { animated, SpringValue, to, useSpring, useSprings } from "react-spring"

const PARTICLES = 70
const RIPPLES = 4

interface LockAnimationProps {
  onComplete?: () => void
  size?: number
  play?: boolean
}

const LockAnimation: React.FC<LockAnimationProps> = ({ onComplete, size = 260, play = false }) => {
  const idx = useMemo(() => Array.from({ length: PARTICLES }, (_, i) => i), [])
  const hasPlayedRef = useRef(false)

  // DROP: starts huge (close to camera) then shrinks as it drops into place
  // Initialize at starting position (hidden) so animation can begin immediately
  const [lock, lockApi] = useSpring(() => ({
    y: -220,
    rotZ: 6,
    scale: 2.45,
    sx: 1,
    sy: 1,
    opacity: 0,
    config: { tension: 230, friction: 16 },
  }))

  // Shackle angle (open -> closed)
  const [shackle, shackleApi] = useSpring(() => ({
    a: -42,
    config: { tension: 520, friction: 32, clamp: true },
  }))

  const [glow, glowApi] = useSpring(() => ({
    g: 0,
    gs: 0.9,
    config: { tension: 220, friction: 18 },
  }))

  const [ripples, rippleApi] = useSprings(RIPPLES, () => ({
    s: 0.2,
    o: 0,
    config: { tension: 140, friction: 18 },
  }))

  const [particles, pApi] = useSprings(PARTICLES, () => ({
    x: 0,
    y: 0,
    s: 0.6,
    o: 0,
    r: 0,
  }))

  const run = useCallback(async () => {
    function startAndWait(
      api: typeof rippleApi,
      count: number,
      factory: (i: number) => Record<string, unknown>,
    ) {
      let remaining = count
      return new Promise<void>((resolve) => {
        api.start((i: number) => ({
          ...factory(i),
          onRest: () => {
            remaining -= 1
            if (remaining === 0) {
              resolve()
            }
          },
        }))
      })
    }

    function startAndWaitPhase(
      api: typeof pApi,
      count: number,
      factory: (i: number) => { burst: Record<string, unknown>; fall: Record<string, unknown> },
    ) {
      type NextFn = (props: {
        x?: number
        y?: number
        s?: number
        o?: number
        r?: number
        delay?: number
        config?: { tension?: number; friction?: number }
      }) => Promise<void>

      let remaining = count
      return new Promise<void>((resolve) => {
        api.start(((i: number) => {
          const { burst, fall } = factory(i)

          return {
            from: { x: 0, y: 0, s: 0.6, o: 0, r: 0 },
            to: async (next: NextFn) => {
              await next(burst)

              remaining -= 1
              if (remaining === 0) {
                resolve()
              }

              await next(fall)
            },
          }
        }) as Parameters<typeof api.start>[0])
      })
    }

    function startAndWaitSingle(
      api: typeof shackleApi | typeof glowApi,
      config: Record<string, unknown>,
    ) {
      return new Promise<void>((resolve) => {
        api.start({
          ...config,
          onRest: () => {
            resolve()
          },
        })
      })
    }

    function waitForLockAnimation(api: typeof lockApi, config: Record<string, unknown>) {
      return new Promise<void>((resolve) => {
        api.start({
          ...config,
          onRest: () => {
            resolve()
          },
        })
      })
    }

    // Reset to starting position
    lockApi.set({ y: -220, rotZ: 6, scale: 2.45, sx: 1, sy: 1, opacity: 0 })
    glowApi.set({ g: 0, gs: 0.9 })
    shackleApi.set({ a: -42 })
    rippleApi.set(() => ({ s: 0.2, o: 0 }))
    pApi.set(() => ({ x: 0, y: 0, s: 0.6, o: 0, r: 0 }))

    // Start particles immediately (don't wait for them)
    startAndWaitPhase(pApi, PARTICLES, () => {
      const a = Math.random() * Math.PI * 2
      const speed = 200 + Math.random() * 320
      const up = 210 + Math.random() * 260

      const x1 = Math.cos(a) * speed
      const y1 = Math.sin(a) * speed - up

      const spin = (Math.random() * 420 - 210) | 0
      const s1 = 0.45 + Math.random() * 1.15
      const delay = Math.random() * 80

      return {
        burst: {
          x: x1,
          y: y1,
          s: s1,
          o: 1,
          r: spin,
          delay,
          config: { tension: 700, friction: 18 },
        },
        fall: {
          y: y1 + (280 + Math.random() * 360),
          o: 0,
          s: s1 * 0.72,
          config: { tension: 120, friction: 30 },
        },
      }
    })

    // Start drop animation
    const dropDone = waitForLockAnimation(lockApi, {
      to: { y: 0, rotZ: 0, scale: 1, sx: 1, sy: 1, opacity: 1 },
      config: { tension: 230, friction: 16 },
    })

    // Start impact squish (will chain after drop)
    waitForLockAnimation(lockApi, {
      to: async (next: (props: Record<string, unknown>) => Promise<void>) => {
        await next({ sx: 1.22, sy: 0.78, config: { tension: 900, friction: 26 } })
        await next({ sx: 0.96, sy: 1.05, config: { tension: 520, friction: 18 } })
        await next({ sx: 1, sy: 1, config: { tension: 420, friction: 18 } })
      },
    })

    // Start ripples (don't wait for them)
    startAndWait(rippleApi, RIPPLES, (i) => ({
      from: { s: 0.18, o: i === 0 ? 0.7 : 0.45 },
      to: { s: 4.2 + i * 1.1, o: 0 },
      delay: i * 70,
      config: { tension: 135, friction: 19, clamp: true },
    }))

    // Wait for drop to complete
    await dropDone

    // Start glow animation when lock drops (pulse effect) - don't wait for it
    glowApi.start({
      to: { g: 1, gs: 1.1 },
      config: { tension: 220, friction: 18 },
      onRest: () => {
        glowApi.start({
          to: { g: 0.3, gs: 1 },
          config: { tension: 180, friction: 20 },
          onRest: () => {
            glowApi.start({
              to: { g: 0, gs: 0.9 },
              config: { tension: 200, friction: 18 },
            })
          },
        })
      },
    })

    // Close the shackle and wait for it to complete
    await startAndWaitSingle(shackleApi, {
      to: { a: 0 },
      config: { tension: 520, friction: 32, clamp: true },
    })

    hasPlayedRef.current = true
    if (onComplete) {
      onComplete()
    }
  }, [glowApi, shackleApi, rippleApi, pApi, lockApi, onComplete])

  useEffect(() => {
    if (play && !hasPlayedRef.current) {
      run()
    }
  }, [play, run])

  const svgSize = size
  const containerSize = size

  return (
    <div
      // eslint-disable-next-line react/forbid-dom-props
      style={{
        position: "relative",
        width: containerSize,
        aspectRatio: "1/1",
        display: "grid",
        placeItems: "center",
        userSelect: "none",
      }}
    >
      {/* Ripples */}
      {ripples.map((spr, i) => (
        <animated.div
          key={i}
          style={{
            position: "absolute",
            width: "100%",
            aspectRatio: "1/1",
            left: "50%",
            top: "66%",
            borderRadius: 999,
            border: i === 0 ? "2px solid rgba(0,0,0,0.22)" : "2px solid rgba(0,0,0,0.13)",
            transform: to([spr.s], (s) => `translate(-50%, -50%) scale(${s})`),
            opacity: spr.o,
            pointerEvents: "none",
          }}
        />
      ))}

      {/* Particles */}
      {particles.map((spr, i) => (
        <animated.div
          key={idx[i]}
          style={{
            position: "absolute",
            left: "50%",
            top: "66%",
            width: 10,
            height: 10,
            borderRadius: 999,
            background: "rgba(0,0,0,0.22)",
            transform: to(
              [spr.x, spr.y, spr.s, spr.r],
              (x, y, s, r) =>
                `translate(-50%, -50%) translate(${x}px, ${y}px) rotate(${r}deg) scale(${s})`,
            ),
            opacity: spr.o,
            pointerEvents: "none",
          }}
        />
      ))}

      {/* Lock (2D drop) */}
      <animated.div
        style={{
          transform: to(
            [lock.y, lock.rotZ, lock.scale, lock.sx, lock.sy],
            (y, rz, sc, sx, sy) =>
              `translateY(${y}px) rotate(${rz}deg) scale(${sc}) scaleX(${sx}) scaleY(${sy})`,
          ),
          opacity: lock.opacity,
          willChange: "transform",
        }}
      >
        <LockSVG shackle={shackle} glow={glow} size={svgSize} />
      </animated.div>
    </div>
  )
}

/**
 * Lock SVG icon from Atlas Icons by Vectopus
 * License: MIT
 * Source: https://github.com/Vectopus/Atlas-icons-react
 */
function LockSVG({
  shackle,
  glow,
  size,
}: {
  shackle: { a: SpringValue<number> }
  glow: { g: SpringValue<number>; gs: SpringValue<number> }
  size: number
}) {
  // IMPORTANT: This shackle path is ONLY the U shape (no bottom seat segment),
  // so rotating it won't sweep across the lock body.
  // It matches your geometry: left leg at x=5.32, right at x=18.68, top arc from 12 @ y=1.5.
  const SHACKLE_U = "M5.32,11.05V8.18A6.68,6.68,0,0,1,12,1.5h0a6.68,6.68,0,0,1,6.68,6.68V11.05"

  // Pivot at left base where shackle meets body top
  const PIVOT_X = 5.32
  const PIVOT_Y = 11.05

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      preserveAspectRatio="xMidYMid meet"
      overflow="visible"
      // eslint-disable-next-line react/forbid-dom-props
      style={{
        width: size,
        height: "auto",
        color: "#111",
        overflow: "visible",
        display: "block",
        shapeRendering: "geometricPrecision",
      }}
    >
      <defs>
        <filter id="glow-filter">
          <feGaussianBlur stdDeviation="3" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <style>{`
        .stroke{
          fill:none;
          stroke:currentColor;
          stroke-width:1.5;
          stroke-miterlimit:10;
          stroke-linecap:round;
          stroke-linejoin:round;
        }
      `}</style>

      {/* Body with glow effect */}
      <animated.g
        style={{
          filter: to([glow.g], (g) => (g > 0.01 ? "url(#glow-filter)" : "none")),
          opacity: to([glow.g], (g) => Math.min(1, 1 + g * 0.15)),
          transform: to([glow.gs], (gs) => `scale(${gs})`),
          transformOrigin: "12px 16.77px",
        }}
      >
        <rect x="2.45" y="11.05" width="19.09" height="11.45" fill="white" />
        <rect className="stroke" x="2.45" y="11.05" width="19.09" height="11.45" />
      </animated.g>

      {/* Shackle (clean close) */}
      <animated.path
        className="stroke"
        d={SHACKLE_U}
        transform={shackle.a.to(
          (deg: number) => `rotate(${deg} ${PIVOT_X} ${PIVOT_Y}) translate(0 -0.2)`,
        )}
      />

      {/* Keyhole */}
      <circle className="stroke" cx="12" cy="15.82" r="0.95" />
      <line className="stroke" x1="12" y1="19.64" x2="12" y2="16.77" />
    </svg>
  )
}

export default LockAnimation

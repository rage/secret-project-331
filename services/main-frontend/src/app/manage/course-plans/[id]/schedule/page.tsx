"use client"

import { css, cx } from "@emotion/css"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import {
  Berries,
  Cabin,
  Campfire,
  CandleLight,
  Leaf,
  MapleLeaf,
  MistyCloud,
  PineTree,
  Sleigh,
  Sunrise,
  WaterLiquid,
  WinterSnowflake,
} from "@vectopus/atlas-icons-react"
import { addMonths, endOfMonth, format, parseISO, startOfMonth } from "date-fns"
import { useAtomValue, useSetAtom } from "jotai"
import { useParams } from "next/navigation"
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { animated, to, useSprings } from "react-spring"

import {
  addMonthToStageAtomFamily,
  draftStagesAtomFamily,
  removeMonthFromStageAtomFamily,
} from "./scheduleAtoms"

import {
  CourseDesignerCourseSize,
  CourseDesignerScheduleStageInput,
  CourseDesignerStage,
  finalizeCourseDesignerSchedule,
  generateCourseDesignerScheduleSuggestion,
  getCourseDesignerPlan,
  saveCourseDesignerSchedule,
} from "@/services/backend/courseDesigner"
import Button from "@/shared-module/common/components/Button"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import Spinner from "@/shared-module/common/components/Spinner"
import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
import { baseTheme } from "@/shared-module/common/styles"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

const STAGE_ORDER: CourseDesignerStage[] = [
  "Analysis",
  "Design",
  "Development",
  "Implementation",
  "Evaluation",
]

const MONTH_ICONS = [
  WinterSnowflake,
  Sleigh,
  Sunrise,
  WaterLiquid,
  Leaf,
  Campfire,
  Cabin,
  Berries,
  MapleLeaf,
  MistyCloud,
  CandleLight,
  PineTree,
] as const

const BLOCK = 72
const GAP = 4
const COL_W = 72

type MonthNode = {
  id: string
  date: Date
  stageIndex: number
  slotIndex: number
  label: string
}

/** Returns for each stage the list of month labels (e.g. "Feb 2026") in that stage's range. */
function getStageMonthLabels(
  stages: Array<CourseDesignerScheduleStageInput>,
): Array<{ stage: CourseDesignerStage; labels: string[] }> {
  return stages.map((s) => {
    const start = parseISO(s.planned_starts_on)
    const end = parseISO(s.planned_ends_on)
    const labels: string[] = []
    let d = startOfMonth(start)
    const endMonth = endOfMonth(end)
    while (d <= endMonth) {
      labels.push(format(d, "MMM yyyy"))
      d = addMonths(d, 1)
    }
    return { stage: s.stage, labels }
  })
}

const containerStyles = css`
  max-width: 1100px;
  margin: 0 auto;
  padding: 2rem;
`

const sectionStyles = css`
  background: white;
  border: 1px solid #d9dde4;
  border-radius: 12px;
  padding: 1rem;
  margin-bottom: 1rem;
`

const toolbarStyles = css`
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  align-items: end;
`

const fieldStyles = css`
  display: flex;
  flex-direction: column;
  gap: 0.25rem;

  input,
  select {
    padding: 0.5rem;
    border-radius: 8px;
    border: 1px solid #c8cfda;
    font: inherit;
  }
`

const stageCardStyles = css`
  display: flex;
  gap: 1rem;
  border: 1px solid ${baseTheme.colors.gray[300]};
  border-radius: 12px;
  padding: 1rem;
  margin-bottom: 0.75rem;
  background: ${baseTheme.colors.gray[50]};
`

const stageMonthBlocksStyles = css`
  display: flex;
  flex-direction: column;
  gap: 4px;
  align-items: stretch;
  flex-shrink: 0;
  width: 72px;
`

const stageMonthBlockStyles = css`
  width: 72px;
  height: 72px;
  background: ${baseTheme.colors.green[400]};
  border: 1px solid ${baseTheme.colors.green[600]};
  border-radius: 4px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 0 0.25rem;
  color: white;
`

const stageMonthBlockMonthStyles = css`
  font-size: 0.8rem;
  font-weight: 600;
  line-height: 1.2;
  text-align: center;
`

const stageMonthBlockYearStyles = css`
  font-size: 0.7rem;
  font-weight: 500;
  opacity: 0.85;
  line-height: 1.2;
`

const stageMonthBlockIconStyles = css`
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 2px;

  svg {
    width: 18px;
    height: 18px;
  }
`

const stageCardRightStyles = css`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`

const stageDescriptionPlaceholderStyles = css`
  font-size: 0.85rem;
  color: ${baseTheme.colors.gray[500]};
  font-style: italic;
`

const stageCardActionsStyles = css`
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
`

const scheduleEditorTimelineRootStyles = css`
  position: relative;
  contain: layout paint;
`

const scheduleMonthOverlayStyles = css`
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: visible;
`

const scheduleMonthOverlayHiddenStyles = css`
  opacity: 0;
`

const todayDateInputValue = () => format(new Date(), "yyyy-MM-dd")

function awaitable(x: unknown): Promise<unknown> {
  return Array.isArray(x)
    ? Promise.all(x.map((v) => (v != null ? Promise.resolve(v) : Promise.resolve())))
    : Promise.resolve(x)
}

const COURSE_DESIGNER_PLAN_QUERY_KEY = "course-designer-plan"

const COURSE_DESIGNER_PLANS_QUERY_KEY = "course-designer-plans"

function CoursePlanSchedulePage() {
  const { t } = useTranslation()
  const params = useParams<{ id: string }>()
  const queryClient = useQueryClient()
  const planId = params.id

  const planQuery = useQuery({
    queryKey: [COURSE_DESIGNER_PLAN_QUERY_KEY, planId],
    queryFn: () => getCourseDesignerPlan(planId),
  })

  const [planName, setPlanName] = useState("")
  // eslint-disable-next-line i18next/no-literal-string
  const [courseSize, setCourseSize] = useState<CourseDesignerCourseSize>("medium")
  const [startsOn, setStartsOn] = useState(todayDateInputValue())
  const [initializedFromQuery, setInitializedFromQuery] = useState<string | null>(null)

  const draftStages = useAtomValue(draftStagesAtomFamily(planId))
  const setDraftStages = useSetAtom(draftStagesAtomFamily(planId))
  const addStageMonth = useSetAtom(addMonthToStageAtomFamily(planId))
  const removeStageMonth = useSetAtom(removeMonthFromStageAtomFamily(planId))

  const stageLabel = useCallback(
    (stage: CourseDesignerStage) => {
      switch (stage) {
        case "Analysis":
          return t("course-plans-stage-analysis")
        case "Design":
          return t("course-plans-stage-design")
        case "Development":
          return t("course-plans-stage-development")
        case "Implementation":
          return t("course-plans-stage-implementation")
        case "Evaluation":
          return t("course-plans-stage-evaluation")
      }
    },
    [t],
  )

  const validateStages = useCallback(
    (stages: Array<CourseDesignerScheduleStageInput>): string | null => {
      if (stages.length !== 5) {
        return t("course-plans-validation-stage-count")
      }
      for (let i = 0; i < stages.length; i++) {
        const stage = stages[i]
        if (stage.planned_starts_on > stage.planned_ends_on) {
          return t("course-plans-validation-stage-range", { stage: stageLabel(stage.stage) })
        }
        if (i > 0) {
          // eslint-disable-next-line i18next/no-literal-string
          const previous = new Date(`${stages[i - 1].planned_ends_on}T00:00:00Z`)
          previous.setUTCDate(previous.getUTCDate() + 1)
          const expected = previous.toISOString().slice(0, 10)
          if (stage.planned_starts_on !== expected) {
            return t("course-plans-validation-contiguous")
          }
        }
      }
      return null
    },
    [t, stageLabel],
  )

  useEffect(() => {
    if (!planQuery.data || initializedFromQuery === planId) {
      return
    }
    setPlanName(planQuery.data.plan.name ?? "")
    if (planQuery.data.stages.length > 0) {
      const stages = planQuery.data.stages.map((stage) => ({
        stage: stage.stage,
        planned_starts_on: stage.planned_starts_on,
        planned_ends_on: stage.planned_ends_on,
      }))
      setDraftStages(stages)
      setStartsOn(planQuery.data.stages[0].planned_starts_on)
    }
    setInitializedFromQuery(planId)
  }, [initializedFromQuery, planId, planQuery.data, setDraftStages])

  const suggestionMutation = useToastMutation(
    () =>
      generateCourseDesignerScheduleSuggestion(planId, {
        course_size: courseSize,
        starts_on: startsOn,
      }),
    { notify: true, method: "POST" },
    {
      onSuccess: (result) => {
        setDraftStages(result.stages)
      },
    },
  )

  const saveMutation = useToastMutation(
    () =>
      saveCourseDesignerSchedule(planId, {
        name: planName.trim() === "" ? null : planName.trim(),
        stages: draftStages,
      }),
    { notify: true, method: "PUT" },
    {
      onSuccess: async (details) => {
        const stages = details.stages.map((stage) => ({
          stage: stage.stage,
          planned_starts_on: stage.planned_starts_on,
          planned_ends_on: stage.planned_ends_on,
        }))
        setDraftStages(stages)
        await queryClient.invalidateQueries({ queryKey: [COURSE_DESIGNER_PLAN_QUERY_KEY, planId] })
        await queryClient.invalidateQueries({ queryKey: [COURSE_DESIGNER_PLANS_QUERY_KEY] })
      },
    },
  )

  const finalizeMutation = useToastMutation(
    () => finalizeCourseDesignerSchedule(planId),
    { notify: true, method: "POST" },
    {
      onSuccess: async () => {
        await queryClient.invalidateQueries({ queryKey: [COURSE_DESIGNER_PLAN_QUERY_KEY, planId] })
        await queryClient.invalidateQueries({ queryKey: [COURSE_DESIGNER_PLANS_QUERY_KEY] })
      },
    },
  )

  const validationError = useMemo(() => validateStages(draftStages), [draftStages, validateStages])

  const stageMonths = useMemo(() => getStageMonthLabels(draftStages), [draftStages])

  const monthNodes: MonthNode[] = useMemo(() => {
    if (draftStages.length !== 5) {
      return []
    }
    const nodes: MonthNode[] = []
    draftStages.forEach((s, stageIndex) => {
      const start = startOfMonth(parseISO(s.planned_starts_on))
      const end = endOfMonth(parseISO(s.planned_ends_on))
      let d = start
      let slot = 0
      while (d <= end) {
        nodes.push({
          id: format(d, "yyyy-MM"),
          date: d,
          stageIndex,
          slotIndex: slot,
          label: format(d, "MMM yyyy"),
        })
        d = addMonths(d, 1)
        slot += 1
      }
    })
    return nodes
  }, [draftStages])

  const scheduleEditorRootRef = useRef<HTMLDivElement | null>(null)
  const monthColRefs = useRef<Array<HTMLDivElement | null>>([])
  const [anchors, setAnchors] = useState<Array<{ x: number; y: number }>>([])
  const [layoutTick, setLayoutTick] = useState(0)
  const pendingAnimRef = useRef(false)
  const prevIdsRef = useRef<Set<string>>(new Set())
  const prevMonthNodesRef = useRef<MonthNode[]>([])
  const prevTargetByIdRef = useRef(new Map<string, { x: number; y: number }>())
  const leavingSnapshotRef = useRef<MonthNode[] | null>(null)
  const leaveAnimGenRef = useRef(0)
  const [leavingNodes, setLeavingNodes] = useState<MonthNode[]>([])
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)
  const [lastChangedStageIndex, setLastChangedStageIndex] = useState<number | null>(null)

  const [cardPulseSprings, cardPulseApi] = useSprings(STAGE_ORDER.length, () => ({
    scale: 1,
    config: { tension: 300, friction: 20 },
  }))

  useEffect(() => {
    if (lastChangedStageIndex === null || anchors.length !== STAGE_ORDER.length) {
      return
    }
    const idx = lastChangedStageIndex
    let timeoutId: ReturnType<typeof setTimeout> | null = null
    const raf2 = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        cardPulseApi.start((i) => (i === idx ? { scale: 1.02 } : {}))
        timeoutId = setTimeout(() => {
          cardPulseApi.start((i) => (i === idx ? { scale: 1 } : {}))
          setLastChangedStageIndex(null)
        }, 400)
      })
    })
    return () => {
      cancelAnimationFrame(raf2)
      if (timeoutId !== null) {
        clearTimeout(timeoutId)
      }
    }
  }, [lastChangedStageIndex, cardPulseApi, anchors.length])

  useEffect(() => {
    // eslint-disable-next-line i18next/no-literal-string -- media query, not user-facing
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
    setPrefersReducedMotion(mq.matches)
    const handler = () => {
      setPrefersReducedMotion(mq.matches)
    }
    mq.addEventListener("change", handler)
    return () => {
      mq.removeEventListener("change", handler)
    }
  }, [])

  const renderedMonthNodes = useMemo(
    () => [...monthNodes, ...leavingNodes],
    [monthNodes, leavingNodes],
  )

  useEffect(() => {
    pendingAnimRef.current = true
  }, [monthNodes])

  useLayoutEffect(() => {
    const root = scheduleEditorRootRef.current
    if (!root || draftStages.length !== 5) {
      return
    }

    const measure = () => {
      const rootRect = root.getBoundingClientRect()
      const next = STAGE_ORDER.map((_, i) => {
        const el = monthColRefs.current[i]
        if (!el) {
          return null
        }
        const r = el.getBoundingClientRect()
        return { x: r.left - rootRect.left, y: r.top - rootRect.top }
      })
      if (next.every(Boolean)) {
        requestAnimationFrame(() => {
          setAnchors(next as Array<{ x: number; y: number }>)
          setLayoutTick((t) => t + 1)
        })
      }
    }

    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(root)
    monthColRefs.current.forEach((el) => el && ro.observe(el))
    window.addEventListener("resize", measure)
    return () => {
      ro.disconnect()
      window.removeEventListener("resize", measure)
    }
  }, [draftStages.length])

  const springConfig = useMemo(
    () =>
      prefersReducedMotion ? { tension: 1000, friction: 100 } : { tension: 160, friction: 32 },
    [prefersReducedMotion],
  )

  const [springs, springsApi] = useSprings(renderedMonthNodes.length, () => ({
    x: 0,
    y: 0,
    scale: 1,
    opacity: 1,
    zIndex: 1,
    config: springConfig,
  }))

  useLayoutEffect(() => {
    if (!pendingAnimRef.current) {
      return
    }
    if (anchors.length !== STAGE_ORDER.length) {
      return
    }
    pendingAnimRef.current = false

    const prev = prevIdsRef.current
    const nextIds = new Set(monthNodes.map((m) => m.id))
    const entering = new Set(Array.from(nextIds).filter((id) => !prev.has(id)))
    const leavingIds = new Set(Array.from(prev).filter((id) => !nextIds.has(id)))
    if (leavingIds.size > 0 && leavingSnapshotRef.current === null) {
      leavingSnapshotRef.current = prevMonthNodesRef.current.filter((m) => leavingIds.has(m.id))
      queueMicrotask(() => setLeavingNodes(leavingSnapshotRef.current ?? []))
    }
    prevMonthNodesRef.current = monthNodes
    prevIdsRef.current = nextIds

    const nodes = renderedMonthNodes
    const nCurrent = monthNodes.length

    springsApi.start((i) => {
      if (i >= nCurrent) {
        return null
      }
      const m = nodes[i]
      const a = anchors[m.stageIndex] ?? { x: 0, y: 0 }
      const tx = a.x
      const ty = a.y + m.slotIndex * (BLOCK + GAP)
      const prevTarget = prevTargetByIdRef.current.get(m.id)
      const isMoving = prevTarget !== undefined && (prevTarget.x !== tx || prevTarget.y !== ty)
      const isEntering = entering.has(m.id)

      if (isEntering) {
        if (prefersReducedMotion) {
          return { x: tx, y: ty, scale: 1, opacity: 1, zIndex: 1, immediate: true }
        }
        return {
          to: [
            {
              x: tx,
              y: ty,
              opacity: 0,
              scale: 0.98,
              zIndex: 1,
              immediate: true,
            },
            {
              x: tx,
              y: ty,
              opacity: 1,
              scale: 1,
              immediate: false,
              config: springConfig,
            },
          ],
        }
      }

      if (isMoving && !prefersReducedMotion) {
        return {
          to: [
            { zIndex: 10, immediate: true },
            {
              x: tx,
              y: ty,
              scale: 1,
              opacity: 1,
              immediate: false,
              config: springConfig,
            },
            { zIndex: 1, immediate: true },
          ],
        }
      }

      return { x: tx, y: ty, scale: 1, opacity: 1, zIndex: 1 }
    })

    const nextMap = new Map<string, { x: number; y: number }>()
    for (const node of monthNodes) {
      const a = anchors[node.stageIndex] ?? { x: 0, y: 0 }
      nextMap.set(node.id, {
        x: a.x,
        y: a.y + node.slotIndex * (BLOCK + GAP),
      })
    }
    const snapshot = leavingSnapshotRef.current
    if (snapshot) {
      for (const m of snapshot) {
        const pos = prevTargetByIdRef.current.get(m.id)
        if (pos) {
          nextMap.set(m.id, pos)
        }
      }
    }
    prevTargetByIdRef.current = nextMap
  }, [
    layoutTick,
    anchors,
    monthNodes,
    renderedMonthNodes,
    springsApi,
    springConfig,
    prefersReducedMotion,
  ])

  useLayoutEffect(() => {
    if (anchors.length !== STAGE_ORDER.length || leavingNodes.length === 0) {
      return
    }
    leaveAnimGenRef.current += 1
    const gen = leaveAnimGenRef.current
    const nCurrent = monthNodes.length
    const nodes = renderedMonthNodes
    const p = springsApi.start((i) => {
      if (i < nCurrent) {
        return null
      }
      const m = nodes[i]
      const a = anchors[m.stageIndex] ?? { x: 0, y: 0 }
      const prevPos = prevTargetByIdRef.current.get(m.id)
      const tx = prevPos?.x ?? a.x
      const ty = prevPos?.y ?? a.y + m.slotIndex * (BLOCK + GAP)
      return {
        x: tx,
        y: ty,
        opacity: 0,
        scale: 0.98,
        zIndex: 1,
        config: springConfig,
      }
    })
    void awaitable(p).then(() => {
      if (leaveAnimGenRef.current !== gen) {
        return
      }
      leavingSnapshotRef.current = null
      setLeavingNodes([])
    })
  }, [
    anchors,
    leavingNodes.length,
    monthNodes.length,
    renderedMonthNodes,
    springsApi,
    springConfig,
  ])

  if (planQuery.isError) {
    return <ErrorBanner variant="readOnly" error={planQuery.error} />
  }

  if (planQuery.isLoading || !planQuery.data) {
    return <Spinner variant="medium" />
  }

  return (
    <div className={containerStyles}>
      <h1>{t("course-plans-schedule-title")}</h1>

      <div className={sectionStyles}>
        <div className={fieldStyles}>
          <label htmlFor="course-plan-name">{t("course-plans-plan-name-label")}</label>
          <input
            id="course-plan-name"
            type="text"
            value={planName}
            onChange={(event) => setPlanName(event.target.value)}
            placeholder={t("course-plans-untitled-plan")}
          />
        </div>
        <p
          className={css`
            margin-top: 0.75rem;
            color: #5d6776;
          `}
        >
          {t("course-plans-schedule-summary", {
            status: planQuery.data.plan.status,
            members: planQuery.data.members.length,
            activeStage: planQuery.data.plan.active_stage
              ? stageLabel(planQuery.data.plan.active_stage)
              : t("course-plans-none"),
          })}
        </p>
      </div>

      <div className={sectionStyles}>
        <h2>{t("course-plans-generate-suggested-schedule")}</h2>
        <div className={toolbarStyles}>
          <div className={fieldStyles}>
            <label htmlFor="course-size">{t("course-plans-course-size-label")}</label>
            <select
              id="course-size"
              value={courseSize}
              onChange={(event) => setCourseSize(event.target.value as CourseDesignerCourseSize)}
            >
              {}
              <option value="small">{t("course-plans-course-size-small")}</option>
              {}
              <option value="medium">{t("course-plans-course-size-medium")}</option>
              {}
              <option value="large">{t("course-plans-course-size-large")}</option>
            </select>
          </div>

          <div className={fieldStyles}>
            <label htmlFor="starts-on">{t("course-plans-starts-on-label")}</label>
            <input
              id="starts-on"
              type="date"
              value={startsOn}
              onChange={(event) => setStartsOn(event.target.value)}
            />
          </div>

          <Button
            variant="secondary"
            size="medium"
            onClick={() => suggestionMutation.mutate()}
            disabled={suggestionMutation.isPending || startsOn.trim() === ""}
          >
            {t("course-plans-generate-suggestion")}
          </Button>
        </div>
      </div>

      <div className={sectionStyles}>
        <h2>{t("course-plans-schedule-editor-title")}</h2>

        {draftStages.length === 0 && <p>{t("course-plans-schedule-empty-help")}</p>}

        {draftStages.length === 5 && (
          <div ref={scheduleEditorRootRef} className={scheduleEditorTimelineRootStyles}>
            <div
              className={css`
                margin-top: 1rem;
              `}
            >
              {STAGE_ORDER.map((stage, stageIndex) => {
                const { labels } = stageMonths[stageIndex] ?? { labels: [] }
                const canShrink = labels.length > 1
                const placeholderHeight =
                  labels.length * (BLOCK + GAP) - (labels.length > 0 ? GAP : 0)
                return (
                  <animated.div
                    key={stage}
                    className={stageCardStyles}
                    data-testid={`course-plan-stage-${stage}`}
                    style={{
                      transform: cardPulseSprings[stageIndex].scale.to((s) => `scale(${s})`),
                    }}
                  >
                    <div
                      className={stageMonthBlocksStyles}
                      ref={(el) => {
                        monthColRefs.current[stageIndex] = el
                      }}
                    >
                      <div
                        className={css`
                          height: ${placeholderHeight}px;
                        `}
                        aria-hidden
                      />
                    </div>
                    <div className={stageCardRightStyles}>
                      <h3
                        className={css`
                          margin: 0;
                          font-size: 1.1rem;
                          font-weight: 600;
                          color: ${baseTheme.colors.gray[700]};
                        `}
                      >
                        {stageLabel(stage)}
                      </h3>
                      <p className={stageDescriptionPlaceholderStyles}>
                        {t("course-plans-stage-description-placeholder")}
                      </p>
                      <div className={stageCardActionsStyles}>
                        <Button
                          variant="secondary"
                          size="small"
                          onClick={() => {
                            setLastChangedStageIndex(stageIndex)
                            addStageMonth(stageIndex)
                          }}
                        >
                          {t("course-plans-add-one-month")}
                        </Button>
                        <Button
                          variant="secondary"
                          size="small"
                          onClick={() => {
                            setLastChangedStageIndex(stageIndex)
                            removeStageMonth(stageIndex)
                          }}
                          disabled={!canShrink}
                        >
                          {t("course-plans-remove-one-month")}
                        </Button>
                      </div>
                    </div>
                  </animated.div>
                )
              })}
            </div>
            <div
              className={cx(
                scheduleMonthOverlayStyles,
                anchors.length !== STAGE_ORDER.length && scheduleMonthOverlayHiddenStyles,
              )}
            >
              {springs.map((s, i) => {
                const m = renderedMonthNodes[i]
                const MonthIcon = MONTH_ICONS[m.date.getMonth()]
                return (
                  <animated.div
                    key={m.id}
                    className={css`
                      position: absolute;
                      width: ${COL_W}px;
                      height: ${BLOCK}px;
                      will-change: transform;
                    `}
                    style={{
                      transform: to(
                        [s.x, s.y, s.scale],
                        (x, y, scale) => `translate3d(${x}px, ${y}px, 0) scale(${scale})`,
                      ),
                      opacity: s.opacity,
                      zIndex: s.zIndex,
                    }}
                  >
                    <div className={stageMonthBlockStyles} title={m.label}>
                      <div className={stageMonthBlockIconStyles}>
                        <MonthIcon />
                      </div>
                      <span className={stageMonthBlockMonthStyles}>{format(m.date, "MMMM")}</span>
                      <span className={stageMonthBlockYearStyles}>{format(m.date, "yyyy")}</span>
                    </div>
                  </animated.div>
                )
              })}
            </div>
          </div>
        )}

        {validationError && (
          <div
            className={css`
              margin-top: 0.75rem;
              color: #8d2323;
              font-weight: 600;
            `}
          >
            {validationError}
          </div>
        )}

        <div
          className={css`
            display: flex;
            flex-wrap: wrap;
            gap: 0.75rem;
            margin-top: 1rem;
          `}
        >
          <Button
            variant="primary"
            size="medium"
            disabled={
              draftStages.length !== 5 || validationError !== null || saveMutation.isPending
            }
            onClick={() => saveMutation.mutate()}
          >
            {t("course-plans-save-schedule")}
          </Button>
          <Button
            variant="secondary"
            size="medium"
            disabled={
              draftStages.length !== 5 ||
              validationError !== null ||
              finalizeMutation.isPending ||
              saveMutation.isPending
            }
            onClick={() => finalizeMutation.mutate()}
          >
            {t("course-plans-finalize-schedule")}
          </Button>
        </div>
      </div>
    </div>
  )
}

export default withErrorBoundary(withSignedIn(CoursePlanSchedulePage))

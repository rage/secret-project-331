// @vitest-environment node
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest"

import type { ExerciseTaskGradingResult } from "@/util/exerciseServiceApi"

import type { RemoteGradingStore } from "./gradingStore"
import { storeFactories } from "./testStores"

const GRADING = {
  request: {
    submission: {
      answer: { name: "answer.tar.zst", mime: "application/zstd", downloadUrl: "http://lms/a" },
      templateDownloadUrl: "http://lms/t",
    },
    gradingUpdateUrl: "http://lms/grading-update/1",
    gradingUpdateClaim: null,
  },
  submissionId: "cmf-1",
  createdAtMs: 1,
}

const OUTCOME: ExerciseTaskGradingResult = {
  grading_progress: "FullyGraded",
  score_given: 1,
  score_maximum: 1,
  feedback_text: null,
  feedback_json: null,
}

for (const factory of storeFactories()) {
  describe(`the ${factory.name} remote-grading store`, () => {
    let nowMs: number
    let store: RemoteGradingStore

    beforeEach(() => {
      nowMs = Date.now()
      store = factory.store(() => nowMs)
    })

    async function record(nonce: string, isSandboxError: boolean, maxSends: number) {
      const { decision } = await store.recordCallback({
        nonce,
        isSandboxError,
        maxSends,
        nowMs,
        outcome: OUTCOME,
        reportLeaseUntilMs: nowMs + 5000,
      })
      return decision
    }

    async function claimIds(at: number, leaseUntil: number) {
      return (await store.claimDue(at, leaseUntil, 10)).map(({ id }) => id)
    }

    afterEach(async () => {
      await factory.reset()
    })

    afterAll(async () => {
      await factory.close()
    })

    it("keeps the request and counts sends", async () => {
      await store.create("g", GRADING, nowMs + 1000)
      expect(await store.beginSend("g", "n1", 0, nowMs + 1000)).toBe(true)
      expect(await store.get("g")).toEqual({ ...GRADING, sends: 1, outcome: null })
    })

    it("leases a claimed grading until the lease ends", async () => {
      await store.create("g", GRADING, nowMs)
      expect(await store.claimDue(nowMs, nowMs + 1000, 10)).toEqual([{ id: "g", claim: 1 }])
      expect(await claimIds(nowMs + 999, nowMs + 2000)).toEqual([])
      expect(await store.claimDue(nowMs + 1000, nowMs + 2000, 10)).toEqual([{ id: "g", claim: 2 }])
    })

    it("begins a send only under the latest claim", async () => {
      await store.create("g", GRADING, nowMs)
      await store.claimDue(nowMs, nowMs, 10)
      await store.claimDue(nowMs, nowMs + 1000, 10)
      expect(await store.beginSend("g", "n1", 1, nowMs + 1000)).toBe(false)
      expect(await store.beginSend("g", "n1", 2, nowMs + 1000)).toBe(true)
    })

    it("settles for a send only while it is the latest", async () => {
      await store.create("g", GRADING, nowMs)
      await store.beginSend("g", "n1", 0, nowMs)
      await store.beginSend("g", "n2", 0, nowMs)
      expect(await store.settle("g", OUTCOME, nowMs + 5000, "n1")).toBe(false)
      expect(await store.settle("g", OUTCOME, nowMs + 5000, "n2")).toBe(true)
      expect(await store.settle("g", OUTCOME, nowMs + 5000)).toBe(false)
      expect(await store.get("g")).toMatchObject({ outcome: OUTCOME })
    })

    it("keeps a settled grading until it finishes, leased for reporting", async () => {
      await store.create("g", GRADING, nowMs)
      await store.beginSend("g", "n1", 0, nowMs)
      await store.settle("g", OUTCOME, nowMs + 5000)
      expect(await claimIds(nowMs + 4999, nowMs + 9000)).toEqual([])
      expect(await claimIds(nowMs + 5000, nowMs + 9000)).toEqual(["g"])
      await store.finish("g")
      expect(await store.get("g")).toBeNull()
      expect(await claimIds(nowMs + 9000, nowMs + 9999)).toEqual([])
    })

    it("voids older claims and sends once a grading has an outcome", async () => {
      await store.create("g", GRADING, nowMs)
      const [claimed] = await store.claimDue(nowMs, nowMs + 1000, 10)
      await store.beginSend("g", "n1", claimed?.claim ?? -1, nowMs + 1000)
      expect(await record("n1", false, 3)).toBe("report")
      expect(await store.beginSend("g", "n2", claimed?.claim ?? -1, nowMs + 1000)).toBe(false)
      expect(await store.scheduleResend("g", "n1", nowMs + 1000)).toBe(false)
      await store.renewLease("g", nowMs + 60_000)
      expect(await claimIds(nowMs + 5000, nowMs + 9000)).toEqual(["g"])
    })

    it("does not reschedule a send whose callback already came", async () => {
      await store.create("g", GRADING, nowMs)
      await store.beginSend("g", "n1", 0, nowMs + 1000)
      expect(await record("n1", true, 3)).toBe("resend")
      expect(await store.scheduleResend("g", "n1", nowMs + 5000)).toBe(false)
      expect(await claimIds(nowMs, nowMs + 1000)).toEqual(["g"])
    })

    it("decides each callback once", async () => {
      await store.create("g", GRADING, nowMs)
      await store.beginSend("g", "n1", 0, nowMs)
      await store.beginSend("g", "n2", 0, nowMs)
      expect(await record("n1", true, 3)).toBe("ignored")
      expect(await record("n2", false, 3)).toBe("report")
      expect(await record("n2", false, 3)).toBe("duplicate")
      expect(await record("n1", false, 3)).toBe("duplicate")
      expect(await record("other", false, 3)).toBe("unknown")
      expect(await record("other", false, 3)).toBe("duplicate")
    })

    it("reports a sandbox failure once out of sends", async () => {
      await store.create("g", GRADING, nowMs)
      await store.beginSend("g", "n1", 0, nowMs)
      expect(await record("n1", true, 1)).toBe("report")
    })

    it("renews the lease of a grading still being sent only", async () => {
      await store.create("g", GRADING, nowMs)
      await store.renewLease("g", nowMs + 5000)
      expect(await claimIds(nowMs + 4999, nowMs + 9000)).toEqual([])
      expect(await claimIds(nowMs + 5000, nowMs + 9000)).toEqual(["g"])
      await store.finish("g")
      await store.renewLease("g", nowMs)
      expect(await claimIds(nowMs + 9999, nowMs + 9999)).toEqual([])
    })
  })
}

# TMC browser exercise: submission and grading plan

## Current state (after reset)

### Flow

1. **User** edits code in the TMC iframe (AnswerBrowserExercise). State is sent to parent via "current-state" with `user_answer: { type: "browser", files: [...] }`.
2. **Submit button** lives in the main-frontend ExerciseBlock (outside the iframe). On click, it calls `postSubmission({ exercise_slide_id, exercise_task_submissions: [{ exercise_task_id, data_json: answers.get(task.id)?.data }] })`.
3. **LMS** receives the submission, creates records, and sends a **grading request** to TMC `POST /api/grade` with the same submission data (e.g. `submission_data: { type: "browser", files }`).
4. **TMC grade route** builds an archive from `submission_data.files`, runs `prepareSubmission(..., extractSubmissionNaively: true)` for browser (false for editor), runs tests in a pod via `/tmc-run`, reads `/app/test_output.txt`, and POSTs the grading result to the LMS `grading_update_url`.
5. **LMS grading controller** receives the callback at `POST .../grading-update/:submission_id`, calls `exercise_task_gradings::update_grading` only. It does **not** call `propagate_user_exercise_state_update_from_exercise_task_grading_result`, so the grading row is updated but the aggregated user exercise state (points shown in the UI) is not. Where propagation is used elsewhere, the strategy is often `CanAddPointsButCannotRemovePoints`, so a new score of 0 would not reduce an existing higher score.

### Routes we must not break

- **POST /api/grade** – used by the LMS for both editor and browser submissions. Request/response shape must stay the same.
- **POST /api/test** and **GET /api/testrun** – used by the editor and by the browser “Test” button. Same.

So we can change **internal** behavior of the grade route (e.g. how we prepare or score), but not the API contract.

---

## Why “submission still successful” when tests fail

Two separate issues:

1. **LMS does not apply the new score to the user’s visible points**  
   The grading callback only updates the grading row. It does not propagate to user exercise (slide) state, so the UI can still show old points. Even if we propagated, using `CanAddPointsButCannotRemovePoints` would mean “0 points from this run” does not overwrite a previous higher score.

2. **TMC grading might be wrong or inconsistent**
   - Browser uses `extractSubmissionNaively: true` in the grade route; the **Test** button uses `prepareSubmission(..., false)`. So Test and Submit can see different file layouts and give different results.
   - Pod output might be snake_case (`test_results`); the grade route uses `testOutput.testResults`. If so, we throw and send a generic “Failed” result.
   - `score_given` is `testOutput.testResults.flatMap(tr => tr.points).length`. If the CLI only lists earned points in `points`, this is correct (0 when all fail). If the format differs, we might send wrong scores.

---

## Options

### Option A – Backend-only fix (recommended)

**Goal:** Keep the existing Submit button and flow; ensure wrong answers get 0 points and the UI updates.

**Changes:**

1. **LMS (headless-lms)** – in the grading callback controller, after loading submission/slide/grading/exercise:
   - Load slide submission, get-or-create user exercise state and user exercise slide state (same pattern as in `library/grading.rs` for regrading).
   - Call `propagate_user_exercise_state_update_from_exercise_task_grading_result` with **`UserPointsUpdateStrategy::CanAddPointsAndCanRemovePoints`** so the score from TMC (including 0) is always applied.
   - No change to route URLs or request/response shapes.

2. **TMC (optional but recommended)** – in the grade route only:
   - Use **`prepareSubmission(..., false)`** for browser as well, so Submit uses the same preparation as Test and results are consistent.
   - Make parsing robust: accept both camelCase and snake_case from the pod (e.g. `testResults ?? test_results`, and safe `.flatMap`), and ensure `score_given` is 0 when status is TESTS_FAILED if the CLI doesn’t already encode that in `points`.

**Pros:** No iframe/parent protocol changes, no new buttons, editor unchanged.  
**Cons:** None for the “wrong answer = 0 points” requirement.

---

### Option B – “Test that also submits” inside the iframe

**Goal:** One action in the iframe: run tests, and only if they pass, submit to the LMS.

**Idea:**

- In AnswerBrowserExercise, add a single button “Submit” (or “Test & Submit”) that:
  1. Runs tests (POST /api/test, poll GET /api/testrun).
  2. If result is PASSED: send current state to parent and trigger submit (e.g. postMessage “request-submit” with state; parent calls `postSubmission` with that state).
  3. If result is TESTS_FAILED (or error): show test output, do **not** submit.

- The **outer** Submit button (ExerciseBlock) would still be there unless we hide it for TMC browser tasks. If we hide it, we need a reliable way to know “this is a TMC browser exercise” in the parent (e.g. service slug or task type). If we don’t hide it, users have two ways to submit (iframe “Test & Submit” vs outer “Submit”); the outer one would still use the current flow and we’d still need Option A so that flow gives 0 points when tests fail.

**Pros:** Clear UX: “submit only when tests pass.”  
**Cons:** More moving parts (postMessage protocol, optional hiding of outer button), and we still need Option A for the outer Submit and for consistency.

---

### Option C – Submit only from iframe, hide outer button

**Goal:** For TMC browser exercises, only the iframe can submit; the outer Submit is hidden.

- Main-frontend: when rendering an exercise task that is TMC browser, hide the block-level Submit button (e.g. by task type or exercise service).
- Iframe: “Submit” = run tests; if PASSED, postMessage “request-submit” with state; parent calls `postSubmission` with that state. No separate “Test” button, or “Test” only runs tests and “Submit” does test-then-submit.

**Pros:** Single place to submit, no double button.  
**Cons:** Requires main-frontend and iframe changes and a clear rule for when to hide the button; editor and other exercise types must be unchanged.

---

## TMC-only: synchronous grade (get results, no points before we know)

**Change (TMC only):** The grade route now **waits** for grading to finish (pod run + callback to LMS), then returns the grading result in the HTTP response. It no longer returns immediately with `Pending`.

- **Flow:** LMS calls TMC `POST /api/grade` and **awaits** the response. TMC runs the pod, POSTs the result to `grading_update_url`, then returns the same result. The LMS uses the response body to call `update_grading` and only then returns to the host. So the host's submission response is built **after** grading is complete and contains the final `exercise_status` (no Pending, correct `score_given`).
- **Result:** With only this TMC change, the host gets the final result and does not show points before success/failure is known—**provided** the LMS awaits the TMC call before building the submission response (it does: `send_grading_request(...).await?` then `update_grading`).
- **Caveat:** The LMS still does not propagate to user exercise state (that was reverted). So the **grading row** and the **submission response** are correct, but the header points may not update until the user refetches or the main-frontend/LMS propagation is re-applied (see "Edits outside TMC" below).

---

## Recommendation

- **Do Option A first:** fix LMS propagation with `CanAddPointsAndCanRemovePoints` and, in TMC, align browser grading with Test (same preparation, robust parsing). That gives correct points (including 0 for wrong answers) without touching routes or the editor.
- **Option B/C** can be added later if you want “submit only when tests pass” or a single Submit in the iframe; they build on Option A.

---

## Implementation order (Option A)

1. **LMS** – `server/src/controllers/exercise_services/grading.rs`  
   After `update_grading`, load slide submission and user/slide state, then call `propagate_user_exercise_state_update_from_exercise_task_grading_result(..., UserPointsUpdateStrategy::CanAddPointsAndCanRemovePoints)`.

2. **TMC** – `src/app/api/grade/route.ts`
   - For browser, call `prepareSubmission(..., false)` (same as Test).
   - Normalize pod JSON (support both `testResults` and `test_results`), and compute `score_given` from earned points only (e.g. `(testOutput.testResults ?? testOutput.test_results ?? []).flatMap(...).length` or equivalent).
   - Ensure `score_maximum` is never 0 (e.g. `Math.max(1, points.length)`).

No new routes; no changes to POST/GET API shapes.

---

## Edits outside TMC (reverted — re-apply when planning cross-service changes)

The following edits were made outside the TMC service to fix submission UX and points. They have been **reverted** so that only TMC contains submission-related code. Re-apply them when coordinating with main-frontend and headless-lms.

### 1. Headless-LMS — propagate points so 0 is applied

**File:** `services/headless-lms/server/src/controllers/exercise_services/grading.rs`

**Problem:** The grading callback only called `update_grading` (persists the grading row). It did **not** call `propagate_user_exercise_state_update_from_exercise_task_grading_result`, so the user’s aggregated exercise state (points in the header) was never updated. Elsewhere the strategy is often `CanAddPointsButCannotRemovePoints`, so a new score of 0 would not reduce an existing score.

**Change:**

- Add import: `UserPointsUpdateStrategy` from `models::exercise_task_gradings`.
- After loading `submission`, `slide`, `grading`, `exercise`, also load:
  - `slide_submission` = `exercise_slide_submissions::get_by_id(conn, submission.exercise_slide_submission_id)`
  - `user_exercise_state` = `user_exercise_states::get_or_create_user_exercise_state(conn, slide_submission.user_id, exercise.id, slide_submission.course_id, slide_submission.exam_id)`
  - `user_exercise_slide_state` = `user_exercise_slide_states::get_or_insert_by_unique_index(conn, user_exercise_state.id, slide.id)`
- **Replace** the single call `exercise_task_gradings::update_grading(...)` with:
  - `models::library::grading::propagate_user_exercise_state_update_from_exercise_task_grading_result(conn, &exercise, &grading, &grading_result, user_exercise_slide_state, UserPointsUpdateStrategy::CanAddPointsAndCanRemovePoints)`
- Propagation updates the grading row and the user/slide state, so the UI can show 0 points when tests fail.

### 2. Main-frontend — points and iframe state after submit

**Files:**

- `services/main-frontend/src/components/course-material/ContentRenderer/moocfi/ExerciseBlock/index.tsx`
- `services/main-frontend/src/reducers/course-material/exerciseBlockPostThisStateToIFrameReducer.ts`

**Problems:**

- Header showed 1/1 then 0/1 because: (a) submission response had `grading_progress: "Pending"` but `score_given: 1` (stale); (b) we set points from response; (c) then `useEffect` ran when query data updated and overwrote with `score_given` from query (still 1) before grading finished.
- View-submission iframe never received final grading after polling (reducer returned `prevExerciseTask` unchanged on `exerciseDownloaded`).

**Changes:**

**ExerciseBlock (`index.tsx`):**

- **useEffect:** Only sync points from `getCourseMaterialExercise.data` when grading is **not** Pending:
  - Replace `if (getCourseMaterialExercise.data.exercise_status?.score_given)` with:
  - `if (status?.grading_progress !== "Pending" && status?.score_given != null) { setPoints(status.score_given) }` (where `status = getCourseMaterialExercise.data.exercise_status`).
- **onSuccess of postSubmissionMutation:**
  - When `data.exercise_status?.grading_progress === "Pending"`: call `setPoints(0)` (so header shows 0 until result).
  - Else when `data.exercise_status` present: `setPoints(data.exercise_status.score_given ?? 0)`.
  - After `dispatch({ type: "submissionGraded", ... })`: **poll** — `let result = await getCourseMaterialExercise.refetch()` then `while (result.data?.exercise_status?.grading_progress === "Pending" && attempts < 30)` sleep 2s and refetch again; then `setPoints(result.data.exercise_status.score_given ?? 0)`.
  - After polling: if `result.data` exists, dispatch `exerciseDownloaded` with `result.data` (compute `chapterId`, `chapterStatus`, `isChapterLocked` as elsewhere in the file) so the iframe gets the final grading.

**Reducer (`exerciseBlockPostThisStateToIFrameReducer.ts`):**

- In **exerciseDownloaded**, when `prevExerciseTask?.view_type === "view-submission"`: instead of `return prevExerciseTask`, return an updated state that merges in the new grading and user_answer from the payload:
  - `return { ...prevExerciseTask, data: { ...prevExerciseTask.data, grading: exerciseTaskGradingToExerciseTaskGradingResult(exerciseTask.previous_submission_grading), user_answer: exerciseTask.previous_submission?.data_json ?? prevExerciseTask.data.user_answer } }`

### Order to re-apply

1. **LMS first** — so the backend applies 0 points and the refetched exercise has correct score.
2. **Main-frontend** — reducer then ExerciseBlock (so polling + exerciseDownloaded gives the iframe the final state).

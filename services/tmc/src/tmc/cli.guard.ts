/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/explicit-module-boundary-types */

/*
 * Generated type guards for "cli.d.ts".
 * WARNING: Do not manually change this file.
 */
import { CliOutput } from "./cli"

export function isCliOutput(obj: unknown): obj is CliOutput {
  const typedObj = obj as CliOutput
  return (
    (((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
      typedObj["output-kind"] === "output-data" &&
      ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
      (typedObj["status"] === "finished" || typedObj["status"] === "crashed") &&
      typeof typedObj["message"] === "string" &&
      (typedObj["result"] === "logged-in" ||
        typedObj["result"] === "logged-out" ||
        typedObj["result"] === "not-logged-in" ||
        typedObj["result"] === "error" ||
        typedObj["result"] === "executed-command") &&
      (typedObj["data"] === null ||
        (((typedObj["data"] !== null && typeof typedObj["data"] === "object") ||
          typeof typedObj["data"] === "function") &&
          typedObj["data"]["output-data-kind"] === "error" &&
          ((typedObj["data"]["output-data"] !== null &&
            typeof typedObj["data"]["output-data"] === "object") ||
            typeof typedObj["data"]["output-data"] === "function") &&
          (typedObj["data"]["output-data"]["kind"] === "not-logged-in" ||
            typedObj["data"]["output-data"]["kind"] === "generic" ||
            typedObj["data"]["output-data"]["kind"] === "forbidden" ||
            typedObj["data"]["output-data"]["kind"] === "connection-error" ||
            typedObj["data"]["output-data"]["kind"] === "obsolete-client" ||
            typedObj["data"]["output-data"]["kind"] === "invalid-token" ||
            (((typedObj["data"]["output-data"]["kind"] !== null &&
              typeof typedObj["data"]["output-data"]["kind"] === "object") ||
              typeof typedObj["data"]["output-data"]["kind"] === "function") &&
              ((typedObj["data"]["output-data"]["kind"]["failed-exercise-download"] !== null &&
                typeof typedObj["data"]["output-data"]["kind"]["failed-exercise-download"] ===
                  "object") ||
                typeof typedObj["data"]["output-data"]["kind"]["failed-exercise-download"] ===
                  "function") &&
              Array.isArray(
                typedObj["data"]["output-data"]["kind"]["failed-exercise-download"]["completed"],
              ) &&
              typedObj["data"]["output-data"]["kind"]["failed-exercise-download"][
                "completed"
              ].every(
                (e: any) =>
                  ((e !== null && typeof e === "object") || typeof e === "function") &&
                  typeof e["id"] === "number" &&
                  typeof e["course-slug"] === "string" &&
                  typeof e["exercise-slug"] === "string" &&
                  typeof e["path"] === "string",
              ) &&
              Array.isArray(
                typedObj["data"]["output-data"]["kind"]["failed-exercise-download"]["skipped"],
              ) &&
              typedObj["data"]["output-data"]["kind"]["failed-exercise-download"]["skipped"].every(
                (e: any) =>
                  ((e !== null && typeof e === "object") || typeof e === "function") &&
                  typeof e["id"] === "number" &&
                  typeof e["course-slug"] === "string" &&
                  typeof e["exercise-slug"] === "string" &&
                  typeof e["path"] === "string",
              ) &&
              Array.isArray(
                typedObj["data"]["output-data"]["kind"]["failed-exercise-download"]["failed"],
              ) &&
              typedObj["data"]["output-data"]["kind"]["failed-exercise-download"]["failed"].every(
                (e: any) =>
                  Array.isArray(e) &&
                  ((e[0] !== null && typeof e[0] === "object") || typeof e[0] === "function") &&
                  typeof e[0]["id"] === "number" &&
                  typeof e[0]["course-slug"] === "string" &&
                  typeof e[0]["exercise-slug"] === "string" &&
                  typeof e[0]["path"] === "string" &&
                  Array.isArray(e[1]) &&
                  e[1].every((e: any) => typeof e === "string"),
              ))) &&
          Array.isArray(typedObj["data"]["output-data"]["trace"]) &&
          typedObj["data"]["output-data"]["trace"].every((e: any) => typeof e === "string")) ||
        (((typedObj["data"] !== null && typeof typedObj["data"] === "object") ||
          typeof typedObj["data"] === "function") &&
          typedObj["data"]["output-data-kind"] === "validation" &&
          ((typedObj["data"]["output-data"] !== null &&
            typeof typedObj["data"]["output-data"] === "object") ||
            typeof typedObj["data"]["output-data"] === "function") &&
          (typedObj["data"]["output-data"]["strategy"] === "FAIL" ||
            typedObj["data"]["output-data"]["strategy"] === "WARN" ||
            typedObj["data"]["output-data"]["strategy"] === "DISABLED") &&
          (typedObj["data"]["output-data"]["validationErrors"] === null ||
            (((typedObj["data"]["output-data"]["validationErrors"] !== null &&
              typeof typedObj["data"]["output-data"]["validationErrors"] === "object") ||
              typeof typedObj["data"]["output-data"]["validationErrors"] === "function") &&
              Object.entries<any>(typedObj["data"]["output-data"]["validationErrors"]).every(
                ([key, value]) =>
                  Array.isArray(value) &&
                  value.every(
                    (e: any) =>
                      ((e !== null && typeof e === "object") || typeof e === "function") &&
                      typeof e["column"] === "number" &&
                      typeof e["line"] === "number" &&
                      typeof e["message"] === "string" &&
                      typeof e["sourceName"] === "string",
                  ) &&
                  typeof key === "string",
              )))) ||
        (((typedObj["data"] !== null && typeof typedObj["data"] === "object") ||
          typeof typedObj["data"] === "function") &&
          typedObj["data"]["output-data-kind"] === "available-points" &&
          Array.isArray(typedObj["data"]["output-data"]) &&
          typedObj["data"]["output-data"].every((e: any) => typeof e === "string")) ||
        (((typedObj["data"] !== null && typeof typedObj["data"] === "object") ||
          typeof typedObj["data"] === "function") &&
          typedObj["data"]["output-data-kind"] === "exercises" &&
          Array.isArray(typedObj["data"]["output-data"]) &&
          typedObj["data"]["output-data"].every((e: any) => typeof e === "string")) ||
        (((typedObj["data"] !== null && typeof typedObj["data"] === "object") ||
          typeof typedObj["data"] === "function") &&
          typedObj["data"]["output-data-kind"] === "exercise-packaging-configuration" &&
          ((typedObj["data"]["output-data"] !== null &&
            typeof typedObj["data"]["output-data"] === "object") ||
            typeof typedObj["data"]["output-data"] === "function") &&
          Array.isArray(typedObj["data"]["output-data"]["student_file_paths"]) &&
          typedObj["data"]["output-data"]["student_file_paths"].every(
            (e: any) => typeof e === "string",
          ) &&
          Array.isArray(typedObj["data"]["output-data"]["exercise_file_paths"]) &&
          typedObj["data"]["output-data"]["exercise_file_paths"].every(
            (e: any) => typeof e === "string",
          )) ||
        (((typedObj["data"] !== null && typeof typedObj["data"] === "object") ||
          typeof typedObj["data"] === "function") &&
          typedObj["data"]["output-data-kind"] === "local-exercises" &&
          Array.isArray(typedObj["data"]["output-data"]) &&
          typedObj["data"]["output-data"].every(
            (e: any) =>
              ((e !== null && typeof e === "object") || typeof e === "function") &&
              typeof e["exercise-slug"] === "string" &&
              typeof e["exercise-path"] === "string",
          )) ||
        (((typedObj["data"] !== null && typeof typedObj["data"] === "object") ||
          typeof typedObj["data"] === "function") &&
          typedObj["data"]["output-data-kind"] === "refresh-result" &&
          ((typedObj["data"]["output-data"] !== null &&
            typeof typedObj["data"]["output-data"] === "object") ||
            typeof typedObj["data"]["output-data"] === "function") &&
          typeof typedObj["data"]["output-data"]["new-cache-path"] === "string" &&
          typeof typedObj["data"]["output-data"]["course-options"] === "object" &&
          Array.isArray(typedObj["data"]["output-data"]["exercises"]) &&
          typedObj["data"]["output-data"]["exercises"].every(
            (e: any) =>
              ((e !== null && typeof e === "object") || typeof e === "function") &&
              typeof e["name"] === "string" &&
              typeof e["checksum"] === "string" &&
              Array.isArray(e["points"]) &&
              e["points"].every((e: any) => typeof e === "string") &&
              typeof e["sandbox-image"] === "string" &&
              (e["tmcproject-yml"] === null ||
                (((e["tmcproject-yml"] !== null && typeof e["tmcproject-yml"] === "object") ||
                  typeof e["tmcproject-yml"] === "function") &&
                  Array.isArray(e["tmcproject-yml"]["extra_student_files"]) &&
                  e["tmcproject-yml"]["extra_student_files"].every(
                    (e: any) => typeof e === "string",
                  ) &&
                  Array.isArray(e["tmcproject-yml"]["extra_exercise_files"]) &&
                  e["tmcproject-yml"]["extra_exercise_files"].every(
                    (e: any) => typeof e === "string",
                  ) &&
                  Array.isArray(e["tmcproject-yml"]["force_update"]) &&
                  e["tmcproject-yml"]["force_update"].every((e: any) => typeof e === "string") &&
                  (typeof e["tmcproject-yml"]["tests_timeout_ms"] === "undefined" ||
                    typeof e["tmcproject-yml"]["tests_timeout_ms"] === "bigint") &&
                  (typeof e["tmcproject-yml"]["fail_on_valgrind_error"] === "undefined" ||
                    e["tmcproject-yml"]["fail_on_valgrind_error"] === false ||
                    e["tmcproject-yml"]["fail_on_valgrind_error"] === true) &&
                  (typeof e["tmcproject-yml"]["minimum_python_version"] === "undefined" ||
                    (((e["tmcproject-yml"]["minimum_python_version"] !== null &&
                      typeof e["tmcproject-yml"]["minimum_python_version"] === "object") ||
                      typeof e["tmcproject-yml"]["minimum_python_version"] === "function") &&
                      (e["tmcproject-yml"]["minimum_python_version"]["major"] === null ||
                        typeof e["tmcproject-yml"]["minimum_python_version"]["major"] ===
                          "number") &&
                      (e["tmcproject-yml"]["minimum_python_version"]["minor"] === null ||
                        typeof e["tmcproject-yml"]["minimum_python_version"]["minor"] ===
                          "number") &&
                      (e["tmcproject-yml"]["minimum_python_version"]["patch"] === null ||
                        typeof e["tmcproject-yml"]["minimum_python_version"]["patch"] ===
                          "number"))) &&
                  (typeof e["tmcproject-yml"]["sandbox_image"] === "undefined" ||
                    typeof e["tmcproject-yml"]["sandbox_image"] === "string"))),
          )) ||
        (((typedObj["data"] !== null && typeof typedObj["data"] === "object") ||
          typeof typedObj["data"] === "function") &&
          typedObj["data"]["output-data-kind"] === "test-result" &&
          ((typedObj["data"]["output-data"] !== null &&
            typeof typedObj["data"]["output-data"] === "object") ||
            typeof typedObj["data"]["output-data"] === "function") &&
          (typedObj["data"]["output-data"]["status"] === "PASSED" ||
            typedObj["data"]["output-data"]["status"] === "TESTS_FAILED" ||
            typedObj["data"]["output-data"]["status"] === "COMPILE_FAILED" ||
            typedObj["data"]["output-data"]["status"] === "TESTRUN_INTERRUPTED" ||
            typedObj["data"]["output-data"]["status"] === "GENERIC_ERROR") &&
          Array.isArray(typedObj["data"]["output-data"]["testResults"]) &&
          typedObj["data"]["output-data"]["testResults"].every(
            (e: any) =>
              ((e !== null && typeof e === "object") || typeof e === "function") &&
              typeof e["name"] === "string" &&
              typeof e["successful"] === "boolean" &&
              Array.isArray(e["points"]) &&
              e["points"].every((e: any) => typeof e === "string") &&
              typeof e["message"] === "string" &&
              Array.isArray(e["exception"]) &&
              e["exception"].every((e: any) => typeof e === "string"),
          ) &&
          ((typedObj["data"]["output-data"]["logs"] !== null &&
            typeof typedObj["data"]["output-data"]["logs"] === "object") ||
            typeof typedObj["data"]["output-data"]["logs"] === "function") &&
          Object.entries<any>(typedObj["data"]["output-data"]["logs"]).every(
            ([key, value]) => typeof value === "string" && typeof key === "string",
          )) ||
        (((typedObj["data"] !== null && typeof typedObj["data"] === "object") ||
          typeof typedObj["data"] === "function") &&
          typedObj["data"]["output-data-kind"] === "exercise-desc" &&
          ((typedObj["data"]["output-data"] !== null &&
            typeof typedObj["data"]["output-data"] === "object") ||
            typeof typedObj["data"]["output-data"] === "function") &&
          typeof typedObj["data"]["output-data"]["name"] === "string" &&
          Array.isArray(typedObj["data"]["output-data"]["tests"]) &&
          typedObj["data"]["output-data"]["tests"].every(
            (e: any) =>
              ((e !== null && typeof e === "object") || typeof e === "function") &&
              typeof e["name"] === "string" &&
              Array.isArray(e["points"]) &&
              e["points"].every((e: any) => typeof e === "string"),
          )) ||
        (((typedObj["data"] !== null && typeof typedObj["data"] === "object") ||
          typeof typedObj["data"] === "function") &&
          typedObj["data"]["output-data-kind"] === "updated-exercises" &&
          Array.isArray(typedObj["data"]["output-data"]) &&
          typedObj["data"]["output-data"].every(
            (e: any) =>
              ((e !== null && typeof e === "object") || typeof e === "function") &&
              typeof e["id"] === "number",
          )) ||
        (((typedObj["data"] !== null && typeof typedObj["data"] === "object") ||
          typeof typedObj["data"] === "function") &&
          typedObj["data"]["output-data-kind"] === "exercise-download" &&
          ((typedObj["data"]["output-data"] !== null &&
            typeof typedObj["data"]["output-data"] === "object") ||
            typeof typedObj["data"]["output-data"] === "function") &&
          Array.isArray(typedObj["data"]["output-data"]["downloaded"]) &&
          typedObj["data"]["output-data"]["downloaded"].every(
            (e: any) =>
              ((e !== null && typeof e === "object") || typeof e === "function") &&
              typeof e["id"] === "number" &&
              typeof e["course-slug"] === "string" &&
              typeof e["exercise-slug"] === "string" &&
              typeof e["path"] === "string",
          ) &&
          Array.isArray(typedObj["data"]["output-data"]["skipped"]) &&
          typedObj["data"]["output-data"]["skipped"].every(
            (e: any) =>
              ((e !== null && typeof e === "object") || typeof e === "function") &&
              typeof e["id"] === "number" &&
              typeof e["course-slug"] === "string" &&
              typeof e["exercise-slug"] === "string" &&
              typeof e["path"] === "string",
          ) &&
          (typeof typedObj["data"]["output-data"]["failed"] === "undefined" ||
            (Array.isArray(typedObj["data"]["output-data"]["failed"]) &&
              typedObj["data"]["output-data"]["failed"].every(
                (e: any) =>
                  Array.isArray(e) &&
                  ((e[0] !== null && typeof e[0] === "object") || typeof e[0] === "function") &&
                  typeof e[0]["id"] === "number" &&
                  typeof e[0]["course-slug"] === "string" &&
                  typeof e[0]["exercise-slug"] === "string" &&
                  typeof e[0]["path"] === "string" &&
                  Array.isArray(e[1]) &&
                  e[1].every((e: any) => typeof e === "string"),
              )))) ||
        (((typedObj["data"] !== null && typeof typedObj["data"] === "object") ||
          typeof typedObj["data"] === "function") &&
          typedObj["data"]["output-data-kind"] === "combined-course-data" &&
          ((typedObj["data"]["output-data"] !== null &&
            typeof typedObj["data"]["output-data"] === "object") ||
            typeof typedObj["data"]["output-data"] === "function") &&
          ((typedObj["data"]["output-data"]["details"] !== null &&
            typeof typedObj["data"]["output-data"]["details"] === "object") ||
            typeof typedObj["data"]["output-data"]["details"] === "function") &&
          typeof typedObj["data"]["output-data"]["details"]["id"] === "number" &&
          typeof typedObj["data"]["output-data"]["details"]["name"] === "string" &&
          typeof typedObj["data"]["output-data"]["details"]["title"] === "string" &&
          (typedObj["data"]["output-data"]["details"]["description"] === null ||
            typeof typedObj["data"]["output-data"]["details"]["description"] === "string") &&
          typeof typedObj["data"]["output-data"]["details"]["details_url"] === "string" &&
          typeof typedObj["data"]["output-data"]["details"]["unlock_url"] === "string" &&
          typeof typedObj["data"]["output-data"]["details"]["reviews_url"] === "string" &&
          typeof typedObj["data"]["output-data"]["details"]["comet_url"] === "string" &&
          Array.isArray(typedObj["data"]["output-data"]["details"]["spyware_urls"]) &&
          typedObj["data"]["output-data"]["details"]["spyware_urls"].every(
            (e: any) => typeof e === "string",
          ) &&
          Array.isArray(typedObj["data"]["output-data"]["details"]["unlockables"]) &&
          typedObj["data"]["output-data"]["details"]["unlockables"].every(
            (e: any) => typeof e === "string",
          ) &&
          Array.isArray(typedObj["data"]["output-data"]["details"]["exercises"]) &&
          typedObj["data"]["output-data"]["details"]["exercises"].every(
            (e: any) =>
              ((e !== null && typeof e === "object") || typeof e === "function") &&
              typeof e["id"] === "number" &&
              typeof e["name"] === "string" &&
              typeof e["locked"] === "boolean" &&
              (e["deadline_description"] === null ||
                typeof e["deadline_description"] === "string") &&
              (e["deadline"] === null || typeof e["deadline"] === "string") &&
              (e["soft_deadline"] === null || typeof e["soft_deadline"] === "string") &&
              (e["soft_deadline_description"] === null ||
                typeof e["soft_deadline_description"] === "string") &&
              typeof e["checksum"] === "string" &&
              typeof e["return_url"] === "string" &&
              typeof e["zip_url"] === "string" &&
              typeof e["returnable"] === "boolean" &&
              typeof e["requires_review"] === "boolean" &&
              typeof e["attempted"] === "boolean" &&
              typeof e["completed"] === "boolean" &&
              typeof e["reviewed"] === "boolean" &&
              typeof e["all_review_points_given"] === "boolean" &&
              (e["memory_limit"] === null || typeof e["memory_limit"] === "number") &&
              Array.isArray(e["runtime_params"]) &&
              e["runtime_params"].every((e: any) => typeof e === "string") &&
              (e["valgrind_strategy"] === null || typeof e["valgrind_strategy"] === "string") &&
              typeof e["code_review_requests_enabled"] === "boolean" &&
              typeof e["run_tests_locally_action_enabled"] === "boolean" &&
              (e["latest_submission_url"] === null ||
                typeof e["latest_submission_url"] === "string") &&
              (e["latest_submission_id"] === null ||
                typeof e["latest_submission_id"] === "number") &&
              (e["solution_zip_url"] === null || typeof e["solution_zip_url"] === "string"),
          ) &&
          Array.isArray(typedObj["data"]["output-data"]["exercises"]) &&
          typedObj["data"]["output-data"]["exercises"].every(
            (e: any) =>
              ((e !== null && typeof e === "object") || typeof e === "function") &&
              typeof e["id"] === "number" &&
              Array.isArray(e["available_points"]) &&
              e["available_points"].every(
                (e: any) =>
                  ((e !== null && typeof e === "object") || typeof e === "function") &&
                  typeof e["id"] === "number" &&
                  typeof e["exercise_id"] === "number" &&
                  typeof e["name"] === "string" &&
                  typeof e["requires_review"] === "boolean",
              ) &&
              Array.isArray(e["awarded_points"]) &&
              e["awarded_points"].every((e: any) => typeof e === "string") &&
              typeof e["name"] === "string" &&
              (e["publish_time"] === null || typeof e["publish_time"] === "string") &&
              (e["solution_visible_after"] === null ||
                typeof e["solution_visible_after"] === "string") &&
              (e["deadline"] === null || typeof e["deadline"] === "string") &&
              (e["soft_deadline"] === null || typeof e["soft_deadline"] === "string") &&
              typeof e["disabled"] === "boolean" &&
              typeof e["unlocked"] === "boolean",
          ) &&
          ((typedObj["data"]["output-data"]["settings"] !== null &&
            typeof typedObj["data"]["output-data"]["settings"] === "object") ||
            typeof typedObj["data"]["output-data"]["settings"] === "function") &&
          typeof typedObj["data"]["output-data"]["settings"]["name"] === "string" &&
          (typedObj["data"]["output-data"]["settings"]["hide_after"] === null ||
            typeof typedObj["data"]["output-data"]["settings"]["hide_after"] === "string") &&
          typeof typedObj["data"]["output-data"]["settings"]["hidden"] === "boolean" &&
          (typedObj["data"]["output-data"]["settings"]["cache_version"] === null ||
            typeof typedObj["data"]["output-data"]["settings"]["cache_version"] === "number") &&
          (typedObj["data"]["output-data"]["settings"]["spreadsheet_key"] === null ||
            typeof typedObj["data"]["output-data"]["settings"]["spreadsheet_key"] === "string") &&
          (typedObj["data"]["output-data"]["settings"]["hidden_if_registered_after"] === null ||
            typeof typedObj["data"]["output-data"]["settings"]["hidden_if_registered_after"] ===
              "string") &&
          (typedObj["data"]["output-data"]["settings"]["refreshed_at"] === null ||
            typeof typedObj["data"]["output-data"]["settings"]["refreshed_at"] === "string") &&
          typeof typedObj["data"]["output-data"]["settings"]["locked_exercise_points_visible"] ===
            "boolean" &&
          (typedObj["data"]["output-data"]["settings"]["description"] === null ||
            typeof typedObj["data"]["output-data"]["settings"]["description"] === "string") &&
          (typedObj["data"]["output-data"]["settings"]["paste_visibility"] === null ||
            typeof typedObj["data"]["output-data"]["settings"]["paste_visibility"] === "number") &&
          (typedObj["data"]["output-data"]["settings"]["formal_name"] === null ||
            typeof typedObj["data"]["output-data"]["settings"]["formal_name"] === "string") &&
          (typedObj["data"]["output-data"]["settings"]["certificate_downloadable"] === null ||
            typedObj["data"]["output-data"]["settings"]["certificate_downloadable"] === false ||
            typedObj["data"]["output-data"]["settings"]["certificate_downloadable"] === true) &&
          (typedObj["data"]["output-data"]["settings"]["certificate_unlock_spec"] === null ||
            typeof typedObj["data"]["output-data"]["settings"]["certificate_unlock_spec"] ===
              "string") &&
          (typedObj["data"]["output-data"]["settings"]["organization_id"] === null ||
            typeof typedObj["data"]["output-data"]["settings"]["organization_id"] === "number") &&
          (typedObj["data"]["output-data"]["settings"]["disabled_status"] === null ||
            typeof typedObj["data"]["output-data"]["settings"]["disabled_status"] === "string") &&
          (typedObj["data"]["output-data"]["settings"]["title"] === null ||
            typeof typedObj["data"]["output-data"]["settings"]["title"] === "string") &&
          (typedObj["data"]["output-data"]["settings"]["material_url"] === null ||
            typeof typedObj["data"]["output-data"]["settings"]["material_url"] === "string") &&
          (typedObj["data"]["output-data"]["settings"]["course_template_id"] === null ||
            typeof typedObj["data"]["output-data"]["settings"]["course_template_id"] ===
              "number") &&
          typeof typedObj["data"]["output-data"]["settings"]["hide_submission_results"] ===
            "boolean" &&
          (typedObj["data"]["output-data"]["settings"]["external_scoreboard_url"] === null ||
            typeof typedObj["data"]["output-data"]["settings"]["external_scoreboard_url"] ===
              "string") &&
          (typedObj["data"]["output-data"]["settings"]["organization_slug"] === null ||
            typeof typedObj["data"]["output-data"]["settings"]["organization_slug"] ===
              "string")) ||
        (((typedObj["data"] !== null && typeof typedObj["data"] === "object") ||
          typeof typedObj["data"] === "function") &&
          typedObj["data"]["output-data-kind"] === "course-details" &&
          ((typedObj["data"]["output-data"] !== null &&
            typeof typedObj["data"]["output-data"] === "object") ||
            typeof typedObj["data"]["output-data"] === "function") &&
          typeof typedObj["data"]["output-data"]["id"] === "number" &&
          typeof typedObj["data"]["output-data"]["name"] === "string" &&
          typeof typedObj["data"]["output-data"]["title"] === "string" &&
          (typedObj["data"]["output-data"]["description"] === null ||
            typeof typedObj["data"]["output-data"]["description"] === "string") &&
          typeof typedObj["data"]["output-data"]["details_url"] === "string" &&
          typeof typedObj["data"]["output-data"]["unlock_url"] === "string" &&
          typeof typedObj["data"]["output-data"]["reviews_url"] === "string" &&
          typeof typedObj["data"]["output-data"]["comet_url"] === "string" &&
          Array.isArray(typedObj["data"]["output-data"]["spyware_urls"]) &&
          typedObj["data"]["output-data"]["spyware_urls"].every(
            (e: any) => typeof e === "string",
          ) &&
          Array.isArray(typedObj["data"]["output-data"]["unlockables"]) &&
          typedObj["data"]["output-data"]["unlockables"].every((e: any) => typeof e === "string") &&
          Array.isArray(typedObj["data"]["output-data"]["exercises"]) &&
          typedObj["data"]["output-data"]["exercises"].every(
            (e: any) =>
              ((e !== null && typeof e === "object") || typeof e === "function") &&
              typeof e["id"] === "number" &&
              typeof e["name"] === "string" &&
              typeof e["locked"] === "boolean" &&
              (e["deadline_description"] === null ||
                typeof e["deadline_description"] === "string") &&
              (e["deadline"] === null || typeof e["deadline"] === "string") &&
              (e["soft_deadline"] === null || typeof e["soft_deadline"] === "string") &&
              (e["soft_deadline_description"] === null ||
                typeof e["soft_deadline_description"] === "string") &&
              typeof e["checksum"] === "string" &&
              typeof e["return_url"] === "string" &&
              typeof e["zip_url"] === "string" &&
              typeof e["returnable"] === "boolean" &&
              typeof e["requires_review"] === "boolean" &&
              typeof e["attempted"] === "boolean" &&
              typeof e["completed"] === "boolean" &&
              typeof e["reviewed"] === "boolean" &&
              typeof e["all_review_points_given"] === "boolean" &&
              (e["memory_limit"] === null || typeof e["memory_limit"] === "number") &&
              Array.isArray(e["runtime_params"]) &&
              e["runtime_params"].every((e: any) => typeof e === "string") &&
              (e["valgrind_strategy"] === null || typeof e["valgrind_strategy"] === "string") &&
              typeof e["code_review_requests_enabled"] === "boolean" &&
              typeof e["run_tests_locally_action_enabled"] === "boolean" &&
              (e["latest_submission_url"] === null ||
                typeof e["latest_submission_url"] === "string") &&
              (e["latest_submission_id"] === null ||
                typeof e["latest_submission_id"] === "number") &&
              (e["solution_zip_url"] === null || typeof e["solution_zip_url"] === "string"),
          )) ||
        (((typedObj["data"] !== null && typeof typedObj["data"] === "object") ||
          typeof typedObj["data"] === "function") &&
          typedObj["data"]["output-data-kind"] === "course-exercises" &&
          Array.isArray(typedObj["data"]["output-data"]) &&
          typedObj["data"]["output-data"].every(
            (e: any) =>
              ((e !== null && typeof e === "object") || typeof e === "function") &&
              typeof e["id"] === "number" &&
              Array.isArray(e["available_points"]) &&
              e["available_points"].every(
                (e: any) =>
                  ((e !== null && typeof e === "object") || typeof e === "function") &&
                  typeof e["id"] === "number" &&
                  typeof e["exercise_id"] === "number" &&
                  typeof e["name"] === "string" &&
                  typeof e["requires_review"] === "boolean",
              ) &&
              Array.isArray(e["awarded_points"]) &&
              e["awarded_points"].every((e: any) => typeof e === "string") &&
              typeof e["name"] === "string" &&
              (e["publish_time"] === null || typeof e["publish_time"] === "string") &&
              (e["solution_visible_after"] === null ||
                typeof e["solution_visible_after"] === "string") &&
              (e["deadline"] === null || typeof e["deadline"] === "string") &&
              (e["soft_deadline"] === null || typeof e["soft_deadline"] === "string") &&
              typeof e["disabled"] === "boolean" &&
              typeof e["unlocked"] === "boolean",
          )) ||
        (((typedObj["data"] !== null && typeof typedObj["data"] === "object") ||
          typeof typedObj["data"] === "function") &&
          typedObj["data"]["output-data-kind"] === "course-data" &&
          ((typedObj["data"]["output-data"] !== null &&
            typeof typedObj["data"]["output-data"] === "object") ||
            typeof typedObj["data"]["output-data"] === "function") &&
          typeof typedObj["data"]["output-data"]["name"] === "string" &&
          (typedObj["data"]["output-data"]["hide_after"] === null ||
            typeof typedObj["data"]["output-data"]["hide_after"] === "string") &&
          typeof typedObj["data"]["output-data"]["hidden"] === "boolean" &&
          (typedObj["data"]["output-data"]["cache_version"] === null ||
            typeof typedObj["data"]["output-data"]["cache_version"] === "number") &&
          (typedObj["data"]["output-data"]["spreadsheet_key"] === null ||
            typeof typedObj["data"]["output-data"]["spreadsheet_key"] === "string") &&
          (typedObj["data"]["output-data"]["hidden_if_registered_after"] === null ||
            typeof typedObj["data"]["output-data"]["hidden_if_registered_after"] === "string") &&
          (typedObj["data"]["output-data"]["refreshed_at"] === null ||
            typeof typedObj["data"]["output-data"]["refreshed_at"] === "string") &&
          typeof typedObj["data"]["output-data"]["locked_exercise_points_visible"] === "boolean" &&
          (typedObj["data"]["output-data"]["description"] === null ||
            typeof typedObj["data"]["output-data"]["description"] === "string") &&
          (typedObj["data"]["output-data"]["paste_visibility"] === null ||
            typeof typedObj["data"]["output-data"]["paste_visibility"] === "number") &&
          (typedObj["data"]["output-data"]["formal_name"] === null ||
            typeof typedObj["data"]["output-data"]["formal_name"] === "string") &&
          (typedObj["data"]["output-data"]["certificate_downloadable"] === null ||
            typedObj["data"]["output-data"]["certificate_downloadable"] === false ||
            typedObj["data"]["output-data"]["certificate_downloadable"] === true) &&
          (typedObj["data"]["output-data"]["certificate_unlock_spec"] === null ||
            typeof typedObj["data"]["output-data"]["certificate_unlock_spec"] === "string") &&
          (typedObj["data"]["output-data"]["organization_id"] === null ||
            typeof typedObj["data"]["output-data"]["organization_id"] === "number") &&
          (typedObj["data"]["output-data"]["disabled_status"] === null ||
            typeof typedObj["data"]["output-data"]["disabled_status"] === "string") &&
          (typedObj["data"]["output-data"]["title"] === null ||
            typeof typedObj["data"]["output-data"]["title"] === "string") &&
          (typedObj["data"]["output-data"]["material_url"] === null ||
            typeof typedObj["data"]["output-data"]["material_url"] === "string") &&
          (typedObj["data"]["output-data"]["course_template_id"] === null ||
            typeof typedObj["data"]["output-data"]["course_template_id"] === "number") &&
          typeof typedObj["data"]["output-data"]["hide_submission_results"] === "boolean" &&
          (typedObj["data"]["output-data"]["external_scoreboard_url"] === null ||
            typeof typedObj["data"]["output-data"]["external_scoreboard_url"] === "string") &&
          (typedObj["data"]["output-data"]["organization_slug"] === null ||
            typeof typedObj["data"]["output-data"]["organization_slug"] === "string")) ||
        (((typedObj["data"] !== null && typeof typedObj["data"] === "object") ||
          typeof typedObj["data"] === "function") &&
          typedObj["data"]["output-data-kind"] === "courses" &&
          Array.isArray(typedObj["data"]["output-data"]) &&
          typedObj["data"]["output-data"].every(
            (e: any) =>
              ((e !== null && typeof e === "object") || typeof e === "function") &&
              typeof e["id"] === "number" &&
              typeof e["name"] === "string" &&
              typeof e["title"] === "string" &&
              (e["description"] === null || typeof e["description"] === "string") &&
              typeof e["details_url"] === "string" &&
              typeof e["unlock_url"] === "string" &&
              typeof e["reviews_url"] === "string" &&
              typeof e["comet_url"] === "string" &&
              Array.isArray(e["spyware_urls"]) &&
              e["spyware_urls"].every((e: any) => typeof e === "string"),
          )) ||
        (((typedObj["data"] !== null && typeof typedObj["data"] === "object") ||
          typeof typedObj["data"] === "function") &&
          typedObj["data"]["output-data-kind"] === "exercise-details" &&
          ((typedObj["data"]["output-data"] !== null &&
            typeof typedObj["data"]["output-data"] === "object") ||
            typeof typedObj["data"]["output-data"] === "function") &&
          typeof typedObj["data"]["output-data"]["course_name"] === "string" &&
          typeof typedObj["data"]["output-data"]["course_id"] === "number" &&
          typeof typedObj["data"]["output-data"]["code_review_requests_enabled"] === "boolean" &&
          typeof typedObj["data"]["output-data"]["run_tests_locally_action_enabled"] ===
            "boolean" &&
          typeof typedObj["data"]["output-data"]["exercise_name"] === "string" &&
          typeof typedObj["data"]["output-data"]["exercise_id"] === "number" &&
          (typedObj["data"]["output-data"]["unlocked_at"] === null ||
            typeof typedObj["data"]["output-data"]["unlocked_at"] === "string") &&
          (typedObj["data"]["output-data"]["deadline"] === null ||
            typeof typedObj["data"]["output-data"]["deadline"] === "string") &&
          Array.isArray(typedObj["data"]["output-data"]["submissions"]) &&
          typedObj["data"]["output-data"]["submissions"].every(
            (e: any) =>
              ((e !== null && typeof e === "object") || typeof e === "function") &&
              typeof e["exercise_name"] === "string" &&
              typeof e["id"] === "number" &&
              typeof e["user_id"] === "number" &&
              typeof e["course_id"] === "number" &&
              typeof e["created_at"] === "string" &&
              typeof e["all_tests_passed"] === "boolean" &&
              (e["points"] === null || typeof e["points"] === "string") &&
              typeof e["submitted_zip_url"] === "string" &&
              (e["paste_url"] === null || typeof e["paste_url"] === "string") &&
              (e["processing_time"] === null || typeof e["processing_time"] === "number") &&
              typeof e["reviewed"] === "boolean" &&
              typeof e["requests_review"] === "boolean",
          )) ||
        (((typedObj["data"] !== null && typeof typedObj["data"] === "object") ||
          typeof typedObj["data"] === "function") &&
          typedObj["data"]["output-data-kind"] === "submissions" &&
          Array.isArray(typedObj["data"]["output-data"]) &&
          typedObj["data"]["output-data"].every(
            (e: any) =>
              ((e !== null && typeof e === "object") || typeof e === "function") &&
              typeof e["id"] === "number" &&
              typeof e["user_id"] === "number" &&
              (e["pretest_error"] === null || typeof e["pretest_error"] === "string") &&
              typeof e["created_at"] === "string" &&
              typeof e["exercise_name"] === "string" &&
              typeof e["course_id"] === "number" &&
              typeof e["processed"] === "boolean" &&
              typeof e["all_tests_passed"] === "boolean" &&
              (e["points"] === null || typeof e["points"] === "string") &&
              (e["processing_tried_at"] === null || typeof e["processing_tried_at"] === "string") &&
              (e["processing_began_at"] === null || typeof e["processing_began_at"] === "string") &&
              (e["processing_completed_at"] === null ||
                typeof e["processing_completed_at"] === "string") &&
              typeof e["times_sent_to_sandbox"] === "number" &&
              typeof e["processing_attempts_started_at"] === "string" &&
              (e["params_json"] === null || typeof e["params_json"] === "string") &&
              typeof e["requires_review"] === "boolean" &&
              typeof e["requests_review"] === "boolean" &&
              typeof e["reviewed"] === "boolean" &&
              typeof e["message_for_reviewer"] === "string" &&
              typeof e["newer_submission_reviewed"] === "boolean" &&
              typeof e["review_dismissed"] === "boolean" &&
              typeof e["paste_available"] === "boolean" &&
              typeof e["message_for_paste"] === "string" &&
              (e["paste_key"] === null || typeof e["paste_key"] === "string"),
          )) ||
        (((typedObj["data"] !== null && typeof typedObj["data"] === "object") ||
          typeof typedObj["data"] === "function") &&
          typedObj["data"]["output-data-kind"] === "update-result" &&
          ((typedObj["data"]["output-data"] !== null &&
            typeof typedObj["data"]["output-data"] === "object") ||
            typeof typedObj["data"]["output-data"] === "function") &&
          Array.isArray(typedObj["data"]["output-data"]["created"]) &&
          typedObj["data"]["output-data"]["created"].every(
            (e: any) =>
              ((e !== null && typeof e === "object") || typeof e === "function") &&
              typeof e["id"] === "number" &&
              typeof e["name"] === "string" &&
              typeof e["locked"] === "boolean" &&
              (e["deadline_description"] === null ||
                typeof e["deadline_description"] === "string") &&
              (e["deadline"] === null || typeof e["deadline"] === "string") &&
              (e["soft_deadline"] === null || typeof e["soft_deadline"] === "string") &&
              (e["soft_deadline_description"] === null ||
                typeof e["soft_deadline_description"] === "string") &&
              typeof e["checksum"] === "string" &&
              typeof e["return_url"] === "string" &&
              typeof e["zip_url"] === "string" &&
              typeof e["returnable"] === "boolean" &&
              typeof e["requires_review"] === "boolean" &&
              typeof e["attempted"] === "boolean" &&
              typeof e["completed"] === "boolean" &&
              typeof e["reviewed"] === "boolean" &&
              typeof e["all_review_points_given"] === "boolean" &&
              (e["memory_limit"] === null || typeof e["memory_limit"] === "number") &&
              Array.isArray(e["runtime_params"]) &&
              e["runtime_params"].every((e: any) => typeof e === "string") &&
              (e["valgrind_strategy"] === null || typeof e["valgrind_strategy"] === "string") &&
              typeof e["code_review_requests_enabled"] === "boolean" &&
              typeof e["run_tests_locally_action_enabled"] === "boolean" &&
              (e["latest_submission_url"] === null ||
                typeof e["latest_submission_url"] === "string") &&
              (e["latest_submission_id"] === null ||
                typeof e["latest_submission_id"] === "number") &&
              (e["solution_zip_url"] === null || typeof e["solution_zip_url"] === "string"),
          ) &&
          Array.isArray(typedObj["data"]["output-data"]["updated"]) &&
          typedObj["data"]["output-data"]["updated"].every(
            (e: any) =>
              ((e !== null && typeof e === "object") || typeof e === "function") &&
              typeof e["id"] === "number" &&
              typeof e["name"] === "string" &&
              typeof e["locked"] === "boolean" &&
              (e["deadline_description"] === null ||
                typeof e["deadline_description"] === "string") &&
              (e["deadline"] === null || typeof e["deadline"] === "string") &&
              (e["soft_deadline"] === null || typeof e["soft_deadline"] === "string") &&
              (e["soft_deadline_description"] === null ||
                typeof e["soft_deadline_description"] === "string") &&
              typeof e["checksum"] === "string" &&
              typeof e["return_url"] === "string" &&
              typeof e["zip_url"] === "string" &&
              typeof e["returnable"] === "boolean" &&
              typeof e["requires_review"] === "boolean" &&
              typeof e["attempted"] === "boolean" &&
              typeof e["completed"] === "boolean" &&
              typeof e["reviewed"] === "boolean" &&
              typeof e["all_review_points_given"] === "boolean" &&
              (e["memory_limit"] === null || typeof e["memory_limit"] === "number") &&
              Array.isArray(e["runtime_params"]) &&
              e["runtime_params"].every((e: any) => typeof e === "string") &&
              (e["valgrind_strategy"] === null || typeof e["valgrind_strategy"] === "string") &&
              typeof e["code_review_requests_enabled"] === "boolean" &&
              typeof e["run_tests_locally_action_enabled"] === "boolean" &&
              (e["latest_submission_url"] === null ||
                typeof e["latest_submission_url"] === "string") &&
              (e["latest_submission_id"] === null ||
                typeof e["latest_submission_id"] === "number") &&
              (e["solution_zip_url"] === null || typeof e["solution_zip_url"] === "string"),
          )) ||
        (((typedObj["data"] !== null && typeof typedObj["data"] === "object") ||
          typeof typedObj["data"] === "function") &&
          typedObj["data"]["output-data-kind"] === "organization" &&
          ((typedObj["data"]["output-data"] !== null &&
            typeof typedObj["data"]["output-data"] === "object") ||
            typeof typedObj["data"]["output-data"] === "function") &&
          typeof typedObj["data"]["output-data"]["name"] === "string" &&
          typeof typedObj["data"]["output-data"]["information"] === "string" &&
          typeof typedObj["data"]["output-data"]["slug"] === "string" &&
          typeof typedObj["data"]["output-data"]["logo_path"] === "string" &&
          typeof typedObj["data"]["output-data"]["pinned"] === "boolean") ||
        (((typedObj["data"] !== null && typeof typedObj["data"] === "object") ||
          typeof typedObj["data"] === "function") &&
          typedObj["data"]["output-data-kind"] === "organizations" &&
          Array.isArray(typedObj["data"]["output-data"]) &&
          typedObj["data"]["output-data"].every(
            (e: any) =>
              ((e !== null && typeof e === "object") || typeof e === "function") &&
              typeof e["name"] === "string" &&
              typeof e["information"] === "string" &&
              typeof e["slug"] === "string" &&
              typeof e["logo_path"] === "string" &&
              typeof e["pinned"] === "boolean",
          )) ||
        (((typedObj["data"] !== null && typeof typedObj["data"] === "object") ||
          typeof typedObj["data"] === "function") &&
          typedObj["data"]["output-data-kind"] === "reviews" &&
          Array.isArray(typedObj["data"]["output-data"]) &&
          typedObj["data"]["output-data"].every(
            (e: any) =>
              ((e !== null && typeof e === "object") || typeof e === "function") &&
              typeof e["submission_id"] === "number" &&
              typeof e["exercise_name"] === "string" &&
              typeof e["id"] === "number" &&
              typeof e["marked_as_read"] === "boolean" &&
              typeof e["reviewer_name"] === "string" &&
              typeof e["review_body"] === "string" &&
              Array.isArray(e["points"]) &&
              e["points"].every((e: any) => typeof e === "string") &&
              Array.isArray(e["points_not_awarded"]) &&
              e["points_not_awarded"].every((e: any) => typeof e === "string") &&
              typeof e["url"] === "string" &&
              typeof e["update_url"] === "string" &&
              typeof e["created_at"] === "string" &&
              typeof e["updated_at"] === "string",
          )) ||
        (((typedObj["data"] !== null && typeof typedObj["data"] === "object") ||
          typeof typedObj["data"] === "function") &&
          typedObj["data"]["output-data-kind"] === "token") ||
        (((typedObj["data"] !== null && typeof typedObj["data"] === "object") ||
          typeof typedObj["data"] === "function") &&
          typedObj["data"]["output-data-kind"] === "new-submission" &&
          ((typedObj["data"]["output-data"] !== null &&
            typeof typedObj["data"]["output-data"] === "object") ||
            typeof typedObj["data"]["output-data"] === "function") &&
          typeof typedObj["data"]["output-data"]["show_submission_url"] === "string" &&
          typeof typedObj["data"]["output-data"]["paste_url"] === "string" &&
          typeof typedObj["data"]["output-data"]["submission_url"] === "string") ||
        (((typedObj["data"] !== null && typeof typedObj["data"] === "object") ||
          typeof typedObj["data"] === "function") &&
          typedObj["data"]["output-data-kind"] === "submission-feedback-response" &&
          ((typedObj["data"]["output-data"] !== null &&
            typeof typedObj["data"]["output-data"] === "object") ||
            typeof typedObj["data"]["output-data"] === "function") &&
          typeof typedObj["data"]["output-data"]["api_version"] === "number" &&
          (typedObj["data"]["output-data"]["status"] === "error" ||
            typedObj["data"]["output-data"]["status"] === "processing" ||
            typedObj["data"]["output-data"]["status"] === "fail" ||
            typedObj["data"]["output-data"]["status"] === "ok" ||
            typedObj["data"]["output-data"]["status"] === "hidden")) ||
        (((typedObj["data"] !== null && typeof typedObj["data"] === "object") ||
          typeof typedObj["data"] === "function") &&
          typedObj["data"]["output-data-kind"] === "submission-finished" &&
          ((typedObj["data"]["output-data"] !== null &&
            typeof typedObj["data"]["output-data"] === "object") ||
            typeof typedObj["data"]["output-data"] === "function") &&
          typeof typedObj["data"]["output-data"]["api_version"] === "number" &&
          (typedObj["data"]["output-data"]["all_tests_passed"] === null ||
            typedObj["data"]["output-data"]["all_tests_passed"] === false ||
            typedObj["data"]["output-data"]["all_tests_passed"] === true) &&
          typeof typedObj["data"]["output-data"]["user_id"] === "number" &&
          typeof typedObj["data"]["output-data"]["login"] === "string" &&
          typeof typedObj["data"]["output-data"]["course"] === "string" &&
          typeof typedObj["data"]["output-data"]["exercise_name"] === "string" &&
          (typedObj["data"]["output-data"]["status"] === "error" ||
            typedObj["data"]["output-data"]["status"] === "processing" ||
            typedObj["data"]["output-data"]["status"] === "fail" ||
            typedObj["data"]["output-data"]["status"] === "ok" ||
            typedObj["data"]["output-data"]["status"] === "hidden") &&
          Array.isArray(typedObj["data"]["output-data"]["points"]) &&
          typedObj["data"]["output-data"]["points"].every((e: any) => typeof e === "string") &&
          (typedObj["data"]["output-data"]["valgrind"] === null ||
            typeof typedObj["data"]["output-data"]["valgrind"] === "string") &&
          typeof typedObj["data"]["output-data"]["submission_url"] === "string" &&
          (typedObj["data"]["output-data"]["solution_url"] === null ||
            typeof typedObj["data"]["output-data"]["solution_url"] === "string") &&
          typeof typedObj["data"]["output-data"]["submitted_at"] === "string" &&
          (typedObj["data"]["output-data"]["processing_time"] === null ||
            typeof typedObj["data"]["output-data"]["processing_time"] === "number") &&
          typeof typedObj["data"]["output-data"]["reviewed"] === "boolean" &&
          typeof typedObj["data"]["output-data"]["requests_review"] === "boolean" &&
          (typedObj["data"]["output-data"]["paste_url"] === null ||
            typeof typedObj["data"]["output-data"]["paste_url"] === "string") &&
          (typedObj["data"]["output-data"]["message_for_paste"] === null ||
            typeof typedObj["data"]["output-data"]["message_for_paste"] === "string") &&
          Array.isArray(typedObj["data"]["output-data"]["missing_review_points"]) &&
          typedObj["data"]["output-data"]["missing_review_points"].every(
            (e: any) => typeof e === "string",
          ) &&
          (typedObj["data"]["output-data"]["test_cases"] === null ||
            (Array.isArray(typedObj["data"]["output-data"]["test_cases"]) &&
              typedObj["data"]["output-data"]["test_cases"].every(
                (e: any) =>
                  ((e !== null && typeof e === "object") || typeof e === "function") &&
                  typeof e["name"] === "string" &&
                  typeof e["successful"] === "boolean" &&
                  (e["message"] === null || typeof e["message"] === "string") &&
                  (e["exception"] === null ||
                    (Array.isArray(e["exception"]) &&
                      e["exception"].every((e: any) => typeof e === "string"))) &&
                  (e["detailed_message"] === null || typeof e["detailed_message"] === "string"),
              ))) &&
          (typedObj["data"]["output-data"]["feedback_questions"] === null ||
            (Array.isArray(typedObj["data"]["output-data"]["feedback_questions"]) &&
              typedObj["data"]["output-data"]["feedback_questions"].every(
                (e: any) =>
                  ((e !== null && typeof e === "object") || typeof e === "function") &&
                  typeof e["id"] === "number" &&
                  typeof e["question"] === "string" &&
                  (e["kind"] === "Text" ||
                    (((e["kind"] !== null && typeof e["kind"] === "object") ||
                      typeof e["kind"] === "function") &&
                      ((e["kind"]["IntRange"] !== null &&
                        typeof e["kind"]["IntRange"] === "object") ||
                        typeof e["kind"]["IntRange"] === "function") &&
                      typeof e["kind"]["IntRange"]["lower"] === "number" &&
                      typeof e["kind"]["IntRange"]["upper"] === "number")),
              ))) &&
          (typedObj["data"]["output-data"]["feedback_answer_url"] === null ||
            typeof typedObj["data"]["output-data"]["feedback_answer_url"] === "string") &&
          (typedObj["data"]["output-data"]["error"] === null ||
            typeof typedObj["data"]["output-data"]["error"] === "string") &&
          (typedObj["data"]["output-data"]["validations"] === null ||
            (((typedObj["data"]["output-data"]["validations"] !== null &&
              typeof typedObj["data"]["output-data"]["validations"] === "object") ||
              typeof typedObj["data"]["output-data"]["validations"] === "function") &&
              (typedObj["data"]["output-data"]["validations"]["strategy"] === "FAIL" ||
                typedObj["data"]["output-data"]["validations"]["strategy"] === "WARN" ||
                typedObj["data"]["output-data"]["validations"]["strategy"] === "DISABLED") &&
              (typedObj["data"]["output-data"]["validations"]["validationErrors"] === null ||
                (((typedObj["data"]["output-data"]["validations"]["validationErrors"] !== null &&
                  typeof typedObj["data"]["output-data"]["validations"]["validationErrors"] ===
                    "object") ||
                  typeof typedObj["data"]["output-data"]["validations"]["validationErrors"] ===
                    "function") &&
                  Object.entries<any>(
                    typedObj["data"]["output-data"]["validations"]["validationErrors"],
                  ).every(
                    ([key, value]) =>
                      Array.isArray(value) &&
                      value.every(
                        (e: any) =>
                          ((e !== null && typeof e === "object") || typeof e === "function") &&
                          typeof e["column"] === "number" &&
                          typeof e["line"] === "number" &&
                          typeof e["message"] === "string" &&
                          typeof e["sourceName"] === "string",
                      ) &&
                      typeof key === "string",
                  )))))) ||
        (((typedObj["data"] !== null && typeof typedObj["data"] === "object") ||
          typeof typedObj["data"] === "function") &&
          typedObj["data"]["output-data-kind"] === "config-value") ||
        (((typedObj["data"] !== null && typeof typedObj["data"] === "object") ||
          typeof typedObj["data"] === "function") &&
          typedObj["data"]["output-data-kind"] === "tmc-config" &&
          ((typedObj["data"]["output-data"] !== null &&
            typeof typedObj["data"]["output-data"] === "object") ||
            typeof typedObj["data"]["output-data"] === "function") &&
          typeof typedObj["data"]["output-data"]["projects_dir"] === "string"))) ||
    (((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
      typedObj["output-kind"] === "status-update" &&
      ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
      typedObj["update-data-kind"] === "client-update-data" &&
      ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
      typeof typedObj["finished"] === "boolean" &&
      typeof typedObj["message"] === "string" &&
      typeof typedObj["percent-done"] === "number" &&
      typeof typedObj["time"] === "bigint" &&
      (typedObj["data"] === null ||
        (((typedObj["data"] !== null && typeof typedObj["data"] === "object") ||
          typeof typedObj["data"] === "function") &&
          typedObj["data"]["client-update-data-kind"] === "exercise-download" &&
          typeof typedObj["data"]["id"] === "number" &&
          typeof typedObj["data"]["path"] === "string") ||
        (((typedObj["data"] !== null && typeof typedObj["data"] === "object") ||
          typeof typedObj["data"] === "function") &&
          typedObj["data"]["client-update-data-kind"] === "posted-submission" &&
          ((typedObj["data"] !== null && typeof typedObj["data"] === "object") ||
            typeof typedObj["data"] === "function") &&
          typeof typedObj["data"]["show_submission_url"] === "string" &&
          typeof typedObj["data"]["paste_url"] === "string" &&
          typeof typedObj["data"]["submission_url"] === "string"))) ||
    (((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
      typedObj["output-kind"] === "status-update" &&
      ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
      typedObj["update-data-kind"] === "none" &&
      ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
      typeof typedObj["finished"] === "boolean" &&
      typeof typedObj["message"] === "string" &&
      typeof typedObj["percent-done"] === "number" &&
      typeof typedObj["time"] === "bigint" &&
      typedObj["data"] === null) ||
    (((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
      typedObj["output-kind"] === "notification" &&
      ((typedObj !== null && typeof typedObj === "object") || typeof typedObj === "function") &&
      (typedObj["notification-kind"] === "warning" || typedObj["notification-kind"] === "info") &&
      typeof typedObj["message"] === "string")
  )
}

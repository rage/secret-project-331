# DataGrip Operations

> [!NOTE]
> These operations can only be performed by MOOC Center personnel. Get in touch if you need assistance.

## Hide a page

In DataGrip:

1. In the left panel: `courses_moocfi_production` > `public` > `tables` > `pages` (double-click)
2. Filter: `WHERE id='7f048004-c718-48d2-968d-415d1xxxxxx'` (fill in the page id — find it by opening the page in edit mode on [courses.mooc.fi](https://courses.mooc.fi/) and copying the id from the URL)
3. Scroll to the `hidden` field, right-click > Edit > True
4. Click the green up arrow in the toolbar (Submit)

## See which students generated a certificate for a course instance

In DataGrip:

1. In the left panel: `courses_moocfi_production` > `public` > `tables` > `course_module_completion_certificates` (double-click)
2. Filter: `WHERE course_id = '<ID HERE>'` (find the course id from the URL when editing the course on [courses.mooc.fi](https://courses.mooc.fi/))
3. Scroll to `name_on_certificate`

To view a certificate:

1. Copy the `verification_url` field value
2. Open `https://courses.mooc.fi/certificates/validate/<verification_url>`

## Search for a user

Query the `user_details` table:

```sql
SELECT * FROM user_details WHERE user_id = '<USER ID>';
```

## Find pages with default image alt texts

1. Right-click `public` in the left panel > New > Query console
2. Run:

```sql
SELECT COUNT(content), p.title AS ct, p.url_path
FROM pages p
  JOIN courses c ON p.course_id = c.id
WHERE content::text LIKE '%Add alt%'
AND course_id = '419adc58-e995-4042-a7e9-7affd6bfb59c'
GROUP BY p.title, p.url_path
```

3. Replace `course_id` with the course you want to check
4. Click the green arrow (Execute)

## Number of users who started a course in a date range

1. Right-click `public` in the left panel > New > Query console
2. Run:

```sql
SELECT COUNT(DISTINCT user_id)
FROM course_instance_enrollments
WHERE deleted_at IS NULL
  AND course_id = 'eaa6d8af-5cf8-4bac-a5d0-bc255axxxxxx'
  AND created_at > '2022-10-01'
  AND created_at < ('2022-12-31'::timestamptz + interval '1 day');
```

3. Replace `course_id` with the course you want to check
4. Replace the dates. Both start and end date are included
5. Click the green arrow (Execute)

## Regrade exercise submissions

1. Right-click in the left panel > New > Query console
2. Run to get the submission ids:

```sql
SELECT id
FROM exercise_task_submissions
WHERE exercise_slide_id IN (
  SELECT id FROM exercise_slides
  WHERE exercise_id = '91fdaef8-9519-5a02-8f5f-53ba98xxxxx'
  AND deleted_at IS NULL
)
AND deleted_at IS NULL
```

3. Replace `exercise_id` with the exercise whose submissions you want to regrade. Find it: open the course in admin view > Exercises tab > click the exercise name > copy the id from the URL between `exercises/` and `/submissions`
4. Click the green arrow (Execute)

![2023-10-05_datagrip_execute](https://github.com/rage/secret-project-331/assets/46688963/81982583-622e-462a-b1fd-4959a7d8da32)

5. Export Data > set extractor to CSV > Copy to clipboard

![2023-10-05_datagrip_export_data](https://github.com/rage/secret-project-331/assets/46688963/f56ee791-756a-4684-bae6-d22f70d035ab)

![2023-05-10_datagrip_export_data](https://github.com/rage/secret-project-331/assets/46688963/da9a444c-979b-4776-9548-2a55a8f7424c)

6. Go to https://courses.mooc.fi/manage/regradings/ > New regrading > paste the copied content
7. Set the user points regrading policy (the default "Can add points but cannot remove points" is usually correct) > Create > wait for it to finish

## Number of students who completed a course (for courses with one checkbox)

1. Right-click in the left panel > New > Query console
2. Run:

```sql
SELECT cbqa.answer_value, COUNT(DISTINCT cbqa.user_id)
FROM course_background_question_answers cbqa
  JOIN course_background_questions cbq ON cbqa.course_background_question_id = cbq.id
  JOIN course_module_completions cmc ON cmc.user_id = cbqa.user_id AND cmc.course_id = cbq.course_id
  JOIN course_module_completion_registered_to_study_registries cmcrtsr
    ON cmc.id = cmcrtsr.course_module_completion_id
WHERE cbq.course_id = '${course_id}'
  AND cmc.course_id = '${course_id}'
  AND cbqa.deleted_at IS NULL
  AND cbq.deleted_at IS NULL
  AND cmc.deleted_at IS NULL
  AND cmcrtsr.deleted_at IS NULL
GROUP BY cbqa.answer_value;
```

3. Click the green arrow (Execute)
4. Fill in `course_id` when prompted (find it from the URL when editing the course on [courses.mooc.fi](https://courses.mooc.fi/))

## Exercise iframes that failed to load, per service and browser

Host pages report an exercise iframe that never connected, or a plugin that asked to be reloaded
(it does so after a crash), as an error occurrence with `details.kind = 'exercise-iframe-failure'`.
Occurrences are kept for two months.

1. Right-click `public` in the left panel > New > Query console
2. Run:

```sql
SELECT o.details->>'exercise_service_slug' AS exercise_service,
  o.details->>'failure' AS failure,
  o.details->>'stage' AS stage,
  CASE
    WHEN o.details->>'user_agent' ~ 'iPhone|iPad|iPod' THEN 'iOS'
    WHEN o.details->>'user_agent' ~ 'Edg/' THEN 'Edge'
    WHEN o.details->>'user_agent' ~ 'Firefox/' THEN 'Firefox'
    WHEN o.details->>'user_agent' ~ 'Chrome/' THEN 'Chrome'
    WHEN o.details->>'user_agent' ~ 'Safari/' THEN 'Safari'
    ELSE 'Other'
  END AS browser,
  COUNT(*) AS occurrences,
  COUNT(DISTINCT o.user_id) AS users,
  MAX(o.created_at) AS last_seen
FROM error_occurrences o
WHERE o.details->>'kind' = 'exercise-iframe-failure'
  AND o.created_at > now() - interval '7 days'
  AND o.deleted_at IS NULL
GROUP BY 1, 2, 3, 4
ORDER BY occurrences DESC;
```

3. Click the green arrow (Execute)

To see where they happened, select `o.path`, `o.details->>'course_id'`, `o.details->>'page_id'`,
`o.details->>'exercise_task_id'` and `o.details->>'elapsed_ms'` instead of grouping. `stage` is how
far the handshake got: `mounted` (the iframe document never loaded), `document-loaded` (its scripts
never sent `ready`), `ready-received`, `port-sent` or `state-sent`.

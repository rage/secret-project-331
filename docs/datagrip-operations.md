This page contains operations which require working with the database in DataGrip. 
**NOTE**: These operations can only be performed by the MOOC Center personnel, so please get in touch if you need assistance. 

## Hide page

In DataGrip:
1. In the navigation on the left: `courses_moocfi_production` > `public` > `tables` > `pages` (double click)
2. WHERE id='7f048004-c718-48d2-968d-415d1xxxxxx' (fill in page id. How to find it? Go to edit the page in [courses.mooc.fi](http://courses.mooc.fi/) and from the URL, copy the id).
3. Scroll to field `hidded `> right click > Edit > True
4. Click on the green up arrow in the toolbar ('Submit')

## How to see which students have generated a certificate for a course instance

In DataGrip:
1. In the navigation on the left, select table: `courses_moocfi_production` > `public` > `tables` > `course_module_completion_certificates` (double click)
2. WHERE course_id '<ID HERE>' (fill in page id. How to find it? Go to edit the page in [courses.mooc.fi](http://courses.mooc.fi/) and from the URL, copy the id).
3. Scroll to `name_on_certificate`

How to view a generated certificate:

1. Copy field `verification_url`
2. Paste it as the last part of this URL: https://courses.mooc.fi/certificates/validate/<VERIFICATION URL>

## Search for a user

user_details table
WHERE user_id = '<USER ID>'

## Search for courses with default image alt texts that need to be changed

1. Navigation on the left (Database Explorer) → click second mouse button on 'public' -> New -> Query console
2. Paste in the console:

select COUNT(content),
  p.title as ct, p.url_path
from pages p
  JOIN courses c ON p.course_id = [c.id](http://c.id/)
WHERE content::text LIKE '%Add alt%'
AND course_id='419adc58-e995-4042-a7e9-7affd6bfb59c'
GROUP BY p.title, p.url_path

3. Replace `course_id` with the id that corresponds to the course you want to check.
4. Click the green arrow ('Execute')

## Number of users who have started a course in a date range

1. Navigation on the left (Database Explorer) → click second mouse button on `public` -> New -> Query console
2. Paste in the console:

SELECT COUNT(DISTINCT user_id)
FROM course_instance_enrollments
WHERE deleted_at IS NULL
  AND course_id = 'eaa6d8af-5cf8-4bac-a5d0-bc255axxxxxx'
  AND created_at > '2022-10-01'
  AND created_at < ('2022-12-31'::timestamptz + interval '1 day');

3. Replace `course_id` with the id that corresponds to the course you want to check. 
4. Replace dates. Both start and end date are included in the results.
5. Click the green arrow ('Execute')

## Regrade exercise submissions

1. Navigation on the left (Database Explorer) → click second mouse button -> New -> Query console
2. Paste in the console:

SELECT id
from exercise_task_submissions
WHERE exercise_slide_id in
      (SELECT id FROM exercise_slides WHERE exercise_id = '91fdaef8-9519-5a02-8f5f-53ba98xxxxx' AND deleted_at is null)
  AND deleted_at is null

3. Replace `exercise_id` with the one that corresponds to the exercise whose submissions you want to regrade. How to find the exercise_id? Open the course material in admin view → go to Exercises tab → click the name of the exercise → copy the string between exercises/ and /submissions.
4. Click the green arrow ('Execute')
![2023-10-05_datagrip_execute](https://github.com/rage/secret-project-331/assets/46688963/81982583-622e-462a-b1fd-4959a7d8da32)

5. In the output window: Export Data → Set extractor to CSV (if not by default) → copy to clipboard
![2023-10-05_datagrip_export_data](https://github.com/rage/secret-project-331/assets/46688963/f56ee791-756a-4684-bae6-d22f70d035ab)

![2023-05-10_datagrip_export_data](https://github.com/rage/secret-project-331/assets/46688963/da9a444c-979b-4776-9548-2a55a8f7424c)

6. Go to https://courses.mooc.fi/manage/regradings/ -> click button New regrading -> paste copied content
7. Set the _user points regrading policy_ (default _Can add points but cannot remove points_ is usually good). Click Create button wait until regrading finishes. 

## Number of students who have completed course (from start until present date). 
Works for courses with one checkbox.

1. Navigation on the left (Database Explorer) → click second mouse button -> New -> Query console
2. Paste in the console:

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

3. Click the green arrow ('Execute')
4. Fill in ´course id´ when promted. (How to find it? Go to edit the page in [courses.mooc.fi](http://courses.mooc.fi/) and from the URL, copy the id)

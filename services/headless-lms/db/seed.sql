INSERT INTO organizations (id, "name", slug)
VALUES (
    '1b89e57e-8b57-42f2-9fed-c7a6736e3eec',
    'University of Helsinki, Department of Computer Science',
    'uh-cs'
  );
INSERT INTO organizations (id, "name", slug)
VALUES (
    'b36c94f5-bc87-4bc9-aab8-a0591b9f6f81',
    'University of Helsinki, Department of Mathematics and Statistics',
    'uh-mathstat'
  );
INSERT INTO courses (
    id,
    "name",
    slug,
    organization_id
  )
VALUES (
    'd86cf910-4d26-40e9-8c9c-1cc35294fdbb',
    'Introduction to everything',
    'introduction-to-everything',
    '1b89e57e-8b57-42f2-9fed-c7a6736e3eec'
  );
INSERT INTO course_instances (id, course_id)
VALUES (
    '25800692-0d99-4f29-b741-92d69b0900b9',
    'd86cf910-4d26-40e9-8c9c-1cc35294fdbb'
  );
INSERT INTO courses (
    id,
    "name",
    slug,
    organization_id
  )
VALUES (
    '2d56db91-399a-43e7-b6d0-21c3f18d72af',
    'Introduction to Computer Science',
    'introduction-to-computer-science',
    '1b89e57e-8b57-42f2-9fed-c7a6736e3eec'
  );
INSERT INTO course_instances (id, course_id, variant_status, starts_at)
VALUES (
    '049d8ef0-0d77-4fc5-8870-e215160f464c',
    '2d56db91-399a-43e7-b6d0-21c3f18d72af',
    'upcoming',
    now()
  );
INSERT INTO courses (
    id,
    "name",
    slug,
    organization_id
  )
VALUES (
    '8f605161-125b-449b-a443-c62ffc1b077f',
    'Introduction to Statistics',
    'introduction-to-statistics',
    'b36c94f5-bc87-4bc9-aab8-a0591b9f6f81'
  );
INSERT INTO course_instances (id, course_id, variant_status, ends_at)
VALUES (
    'eb5e96df-4a47-4a6e-995b-6af03f8173ad',
    '8f605161-125b-449b-a443-c62ffc1b077f',
    'active',
    now()
  );
INSERT INTO pages (
    id,
    course_id,
    content,
    url_path,
    title,
    order_number
  )
VALUES (
    'f3b0d699-c9be-4d56-bd0a-9d40e5547e4d',
    'd86cf910-4d26-40e9-8c9c-1cc35294fdbb',
    '[{"name": "core/paragraph", "isValid": true, "clientId": "fdc9354b-4f84-4561-b5fc-b7e77fc07bad", "attributes": {"content": "Everything is a big topic.", "dropCap": false}, "innerBlocks": []}, {"name": "moocfi/exercise", "isValid": true, "clientId": "022157e6-d10c-4f87-9eb3-ee8a17c4f249", "attributes": {"id": "34e47a8e-d573-43be-8f23-79128cbb29b8"}, "innerBlocks": []}]'::jsonb,
    '/',
    'Welcome to Introduction to Everything',
    1
  );
INSERT INTO pages (
    id,
    course_id,
    content,
    url_path,
    title,
    order_number
  )
VALUES (
    'de5590c6-97b3-40f1-b2e1-2195645da509',
    'd86cf910-4d26-40e9-8c9c-1cc35294fdbb',
    '[{"name": "core/paragraph", "isValid": true, "clientId": "e6f023d2-eb6c-436c-996c-13982df9cfa9", "attributes": {"content": "First chapters second page.", "dropCap": false}, "innerBlocks": []}, {"name": "moocfi/exercise", "isValid": true, "clientId": "9cda760e-2309-4782-bd67-57b5d1d4a791", "attributes": {"id": "4b8d6878-89dc-4224-aaa6-488a6dab5d95"}, "innerBlocks": []},{"name": "moocfi/exercise", "isValid": true, "clientId": "62b33173-785f-46f3-9c41-899b7483475d", "attributes": {"id": "a5f201f1-53df-4cfa-90c5-ffa2241a527d"}, "innerBlocks": []},{"name": "moocfi/exercise", "isValid": true, "clientId": "be51aabc-8a06-462a-8ca0-dc3230b2fe77", "attributes": {"id": "e88371c1-aceb-4226-9d7a-a559830646e3"}, "innerBlocks": []}]'::jsonb,
    '/chapter-1/page-2',
    'page 2',
    2
  );
INSERT INTO pages (
    id,
    course_id,
    content,
    url_path,
    title,
    order_number
  )
VALUES (
    'aeac9212-b1d8-4a59-b5fb-1656606e9f5c',
    'd86cf910-4d26-40e9-8c9c-1cc35294fdbb',
    '[{"name": "core/paragraph", "isValid": true, "clientId": "376b8be3-bd9f-493f-a85c-59dd2aaae818bad", "attributes": {"content": "Everything is a big topic.", "dropCap": false}, "innerBlocks": []}, {"name": "moocfi/exercise", "isValid": true, "clientId": "06b3113c-8bef-49ed-b0b0-9ecc33375662", "attributes": {"id": "d313dc8f-c12d-4237-8730-bca936931fc9"}, "innerBlocks": []}]'::jsonb,
    '/',
    'In the second chapter...',
    1
  );
INSERT INTO exercises (id, course_id, "name", page_id, order_number)
VALUES (
    '34e47a8e-d573-43be-8f23-79128cbb29b8',
    'd86cf910-4d26-40e9-8c9c-1cc35294fdbb',
    'Best exercise',
    'f3b0d699-c9be-4d56-bd0a-9d40e5547e4d',
    1
  );
INSERT INTO exercises (id, course_id, "name", page_id, order_number)
VALUES (
    '4b8d6878-89dc-4224-aaa6-488a6dab5d95',
    'd86cf910-4d26-40e9-8c9c-1cc35294fdbb',
    'Second page, first exercise',
    'de5590c6-97b3-40f1-b2e1-2195645da509',
    1
  );
INSERT INTO exercises (id, course_id, "name", page_id, order_number)
VALUES (
    'a5f201f1-53df-4cfa-90c5-ffa2241a527d',
    'd86cf910-4d26-40e9-8c9c-1cc35294fdbb',
    'second page, second exercise',
    'de5590c6-97b3-40f1-b2e1-2195645da509',
    2
  );
INSERT INTO exercises (id, course_id, "name", page_id, order_number)
VALUES (
    'e88371c1-aceb-4226-9d7a-a559830646e3',
    'd86cf910-4d26-40e9-8c9c-1cc35294fdbb',
    'second page, third exercise',
    'de5590c6-97b3-40f1-b2e1-2195645da509',
    3
  );
INSERT INTO exercise_tasks (
    id,
    exercise_id,
    exercise_type,
    assignment,
    private_spec,
    public_spec
  )
VALUES (
    '0125c21b-6afa-4652-89f7-56c48bd8ffe4',
    '34e47a8e-d573-43be-8f23-79128cbb29b8',
    'example',
    '[{"name": "core/paragraph", "isValid": true, "clientId": "6d211c53-9a5b-47c5-a16e-5349466800cb", "attributes": {"content": "Answer this question.", "dropCap": false}, "innerBlocks": []}]'::jsonb,
    '[{"id": "1c206384-8373-40be-bcbd-2940c0eb5205", "name": "a", "correct": false}, {"id": "8f09e9a0-ac20-486a-ba29-704e7eeaf6af", "name": "b", "correct": true}, {"id": "af5cdeb3-7d69-4c32-9f44-d8e2aece3d02", "name": "c", "correct": false}]'::jsonb,
    '[{"id": "1c206384-8373-40be-bcbd-2940c0eb5205", "name": "a"}, {"id": "8f09e9a0-ac20-486a-ba29-704e7eeaf6af", "name": "b"}, {"id": "af5cdeb3-7d69-4c32-9f44-d8e2aece3d02", "name": "c"}]'::jsonb
  );
INSERT INTO exercise_tasks(
    id,
    exercise_id,
    exercise_type,
    assignment,
    private_spec,
    public_spec
  )
VALUES(
    '1a34eb56-39fd-4843-bd2a-b8fdc47ed29e',
    '4b8d6878-89dc-4224-aaa6-488a6dab5d95',
    'example',
    '[{"name": "core/paragraph", "isValid": true, "clientId": "6d211c53-9a5b-47c5-a16e-5349466800cb", "attributes": {"content": "Answer this question.", "dropCap": false}, "innerBlocks": []}]'::jsonb,
    '[{"id": "6f8bcf7e-8c58-42c2-a5f2-a414d5409d2f", "name": "a", "correct": false}, {"id": "a3e19dd3-20c6-4221-a2b8-fd6c243c9d8b", "name": "b", "correct": true}, {"id": "eb46f814-6449-40f4-8f22-36e3eb35866b", "name": "c", "correct": false}]'::jsonb,
    '[{"id": "6f8bcf7e-8c58-42c2-a5f2-a414d5409d2f", "name": "a"}, {"id": "a3e19dd3-20c6-4221-a2b8-fd6c243c9d8b", "name": "b"}, {"id": "eb46f814-6449-40f4-8f22-36e3eb35866b", "name": "c"}]'::jsonb
  );
INSERT INTO exercise_tasks(
    id,
    exercise_id,
    exercise_type,
    assignment,
    private_spec,
    public_spec
  )
VALUES(
    'cfb1935b-86eb-4e4a-99be-4cec74913ced',
    'a5f201f1-53df-4cfa-90c5-ffa2241a527d',
    'example',
    '[{"name": "core/paragraph", "isValid": true, "clientId": "d69b8e16-cb92-4fcb-b7af-11505b1ba740", "attributes": {"content": "Answer this question.", "dropCap": false}, "innerBlocks": []}]'::jsonb,
    '[{"id": "fcfe514b-85b2-4424-a57b-258a6444a09f", "name": "a", "correct": false}, {"id": "1f2a9ab5-aa7b-4574-a554-f94e33716e71", "name": "b", "correct": true}, {"id": "bc10f7b1-ae12-4a9f-beef-07794813c73d", "name": "c", "correct": false}]'::jsonb,
    '[{"id": "fcfe514b-85b2-4424-a57b-258a6444a09f", "name": "a"}, {"id": "1f2a9ab5-aa7b-4574-a554-f94e33716e71", "name": "b"}, {"id": "bc10f7b1-ae12-4a9f-beef-07794813c73d", "name": "c"}]'::jsonb
  );
INSERT INTO exercise_tasks(
    id,
    exercise_id,
    exercise_type,
    assignment,
    private_spec,
    public_spec
  )
VALUES(
    '0d47d266-5dbb-47ad-9831-6f465ac7fd6c',
    'e88371c1-aceb-4226-9d7a-a559830646e3',
    'example',
    '[{"name": "core/paragraph", "isValid": true, "clientId": "c5801ff1-a732-4d0b-b188-4f1cb0cfd0ec", "attributes": {"content": "Answer this question.", "dropCap": false}, "innerBlocks": []}]'::jsonb,
    '[{"id": "83089c9b-9dd3-4a1d-afba-24a4189c5cf8", "name": "a", "correct": false}, {"id": "5945b092-16d6-4891-a1ef-bc377358d9bb", "name": "b", "correct": true}, {"id": "9c4b7f18-0808-42c8-bd4c-6c560ccb13a6", "name": "c", "correct": false}]'::jsonb,
    '[{"id": "83089c9b-9dd3-4a1d-afba-24a4189c5cf8", "name": "a"}, {"id": "5945b092-16d6-4891-a1ef-bc377358d9bb", "name": "b"}, {"id": "9c4b7f18-0808-42c8-bd4c-6c560ccb13a6", "name": "c"}]'::jsonb
  );
INSERT INTO chapters(id, name, course_id, chapter_number)
VALUES (
    'd332f3d9-39a5-4a18-80f4-251727693c37',
    'The Basics',
    'd86cf910-4d26-40e9-8c9c-1cc35294fdbb',
    1
  );
INSERT INTO chapters(id, name, course_id, chapter_number)
VALUES (
    'e9f24363-81ca-425b-ade2-80cc33105e75',
    'The Intermediaries',
    'd86cf910-4d26-40e9-8c9c-1cc35294fdbb',
    2
  );
INSERT INTO users (id)
VALUES ('0589dc46-71a9-4220-baf2-d2f0dc77ef9a');
INSERT INTO users (id)
VALUES ('b8f1d304-aaad-4bd7-a2fe-7598e946029a');
INSERT INTO users (id)
VALUES ('d01e3b4e-e7e6-405d-9407-05dce3eb4434');
INSERT INTO submissions (
    id,
    created_at,
    updated_at,
    exercise_id,
    course_id,
    exercise_task_id,
    user_id,
    course_instance_id
  )
VALUES (
    'f87e11e4-c6e5-40cc-bde7-7c371609643f',
    '1999-01-08',
    '1999-01-08',
    '34e47a8e-d573-43be-8f23-79128cbb29b8',
    'd86cf910-4d26-40e9-8c9c-1cc35294fdbb',
    '0125c21b-6afa-4652-89f7-56c48bd8ffe4',
    '0589dc46-71a9-4220-baf2-d2f0dc77ef9a',
    '25800692-0d99-4f29-b741-92d69b0900b9'
  );
INSERT INTO submissions (
    id,
    created_at,
    updated_at,
    exercise_id,
    course_id,
    exercise_task_id,
    user_id,
    course_instance_id
  )
VALUES (
    '2eb3aaf2-e2a7-4a0c-80c0-e8f3d62660ec',
    '1999-01-09',
    '1999-01-09',
    '34e47a8e-d573-43be-8f23-79128cbb29b8',
    'd86cf910-4d26-40e9-8c9c-1cc35294fdbb',
    '0125c21b-6afa-4652-89f7-56c48bd8ffe4',
    '0589dc46-71a9-4220-baf2-d2f0dc77ef9a',
    '25800692-0d99-4f29-b741-92d69b0900b9'
  );
INSERT INTO submissions (
    id,
    created_at,
    updated_at,
    exercise_id,
    course_id,
    exercise_task_id,
    user_id,
    course_instance_id
  )
VALUES (
    'cc19e9b6-3b47-4e72-b7bc-052eb04dedc7',
    '1999-01-10',
    '1999-01-10',
    '34e47a8e-d573-43be-8f23-79128cbb29b8',
    'd86cf910-4d26-40e9-8c9c-1cc35294fdbb',
    '0125c21b-6afa-4652-89f7-56c48bd8ffe4',
    '0589dc46-71a9-4220-baf2-d2f0dc77ef9a',
    '25800692-0d99-4f29-b741-92d69b0900b9'
  );
INSERT INTO submissions (
    id,
    created_at,
    updated_at,
    exercise_id,
    course_id,
    exercise_task_id,
    user_id,
    course_instance_id
  )
VALUES (
    '2c4fd344-bdc7-42cc-83f0-8836ad752d79',
    '1999-01-11',
    '1999-01-11',
    '34e47a8e-d573-43be-8f23-79128cbb29b8',
    'd86cf910-4d26-40e9-8c9c-1cc35294fdbb',
    '0125c21b-6afa-4652-89f7-56c48bd8ffe4',
    '0589dc46-71a9-4220-baf2-d2f0dc77ef9a',
    '25800692-0d99-4f29-b741-92d69b0900b9'
  );
UPDATE chapters
SET front_page_id = 'f3b0d699-c9be-4d56-bd0a-9d40e5547e4d'
where id = 'd332f3d9-39a5-4a18-80f4-251727693c37';
UPDATE chapters
SET front_page_id = 'aeac9212-b1d8-4a59-b5fb-1656606e9f5c'
where id = 'e9f24363-81ca-425b-ade2-80cc33105e75';
UPDATE pages
SET chapter_id = 'd332f3d9-39a5-4a18-80f4-251727693c37'
where id = 'f3b0d699-c9be-4d56-bd0a-9d40e5547e4d';
UPDATE pages
SET chapter_id = 'e9f24363-81ca-425b-ade2-80cc33105e75'
where id = 'aeac9212-b1d8-4a59-b5fb-1656606e9f5c';
UPDATE pages
SET chapter_id = 'd332f3d9-39a5-4a18-80f4-251727693c37'
where id = 'de5590c6-97b3-40f1-b2e1-2195645da509';
INSERT INTO roles (user_id, organization_id, course_id, role)
VALUES (
    '0589dc46-71a9-4220-baf2-d2f0dc77ef9a',
    NULL,
    NULL,
    'admin'
  );
INSERT INTO roles (user_id, organization_id, course_id, role)
VALUES (
    'b8f1d304-aaad-4bd7-a2fe-7598e946029a',
    '1b89e57e-8b57-42f2-9fed-c7a6736e3eec',
    NULL,
    'teacher'
  );
INSERT INTO roles (user_id, organization_id, course_id, role)
VALUES (
    'd01e3b4e-e7e6-405d-9407-05dce3eb4434',
    '1b89e57e-8b57-42f2-9fed-c7a6736e3eec',
    '2d56db91-399a-43e7-b6d0-21c3f18d72af',
    'assistant'
  );

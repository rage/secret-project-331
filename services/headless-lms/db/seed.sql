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
INSERT INTO courses (id, "name", slug, organization_id)
VALUES (
    'd86cf910-4d26-40e9-8c9c-1cc35294fdbb',
    'Introduction to everything',
    'introduction-to-everything',
    '1b89e57e-8b57-42f2-9fed-c7a6736e3eec'
  );
INSERT INTO courses (id, "name", slug, organization_id)
VALUES (
    '2d56db91-399a-43e7-b6d0-21c3f18d72af',
    'Introduction to Computer Science',
    'introduction-to-computer-science',
    '1b89e57e-8b57-42f2-9fed-c7a6736e3eec'
  );
INSERT INTO courses (id, "name", slug, organization_id)
VALUES (
    '8f605161-125b-449b-a443-c62ffc1b077f',
    'Introduction to Statistics',
    'introduction-to-statistics',
    'b36c94f5-bc87-4bc9-aab8-a0591b9f6f81'
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
    'aeac9212-b1d8-4a59-b5fb-1656606e9f5c',
    'd86cf910-4d26-40e9-8c9c-1cc35294fdbb',
    '[{"name": "core/snd-paragraph", "isValid": true, "clientId": "376b8be3-bd9f-493f-a85c-59dd2aaae818bad", "attributes": {"content": "Everything is a big topic.", "dropCap": false}, "innerBlocks": []}, {"name": "moocfi/snd-exercise", "isValid": true, "clientId": "06b3113c-8bef-49ed-b0b0-9ecc33375662", "attributes": {"id": "d313dc8f-c12d-4237-8730-bca936931fc9"}, "innerBlocks": []}]'::jsonb,
    '/',
    'In the second part...',
    2
  );
INSERT INTO exercises (id, course_id, "name", page_id)
VALUES (
    '34e47a8e-d573-43be-8f23-79128cbb29b8',
    'd86cf910-4d26-40e9-8c9c-1cc35294fdbb',
    'Best exercise',
    'f3b0d699-c9be-4d56-bd0a-9d40e5547e4d'
  );
INSERT INTO exercise_items (
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
INSERT INTO course_parts(id, name, course_id, part_number)
VALUES (
    'd332f3d9-39a5-4a18-80f4-251727693c37',
    'The Basics',
    'd86cf910-4d26-40e9-8c9c-1cc35294fdbb',
    1
  );
INSERT INTO course_parts(id, name, course_id, part_number)
VALUES (
    'e9f24363-81ca-425b-ade2-80cc33105e75',
    'The Intermediaries',
    'd86cf910-4d26-40e9-8c9c-1cc35294fdbb',
    2
  );
INSERT INTO users (id)
VALUES ('0589dc46-71a9-4220-baf2-d2f0dc77ef9a');
INSERT INTO submissions (
    id,
    created_at,
    updated_at,
    exercise_id,
    course_id,
    exercise_item_id,
    user_id
  )
VALUES (
    'f87e11e4-c6e5-40cc-bde7-7c371609643f',
    '1999-01-08',
    '1999-01-08',
    '34e47a8e-d573-43be-8f23-79128cbb29b8',
    'd86cf910-4d26-40e9-8c9c-1cc35294fdbb',
    '0125c21b-6afa-4652-89f7-56c48bd8ffe4',
    '0589dc46-71a9-4220-baf2-d2f0dc77ef9a'
  );
INSERT INTO submissions (
    id,
    created_at,
    updated_at,
    exercise_id,
    course_id,
    exercise_item_id,
    user_id
  )
VALUES (
    '2eb3aaf2-e2a7-4a0c-80c0-e8f3d62660ec',
    '1999-01-09',
    '1999-01-09',
    '34e47a8e-d573-43be-8f23-79128cbb29b8',
    'd86cf910-4d26-40e9-8c9c-1cc35294fdbb',
    '0125c21b-6afa-4652-89f7-56c48bd8ffe4',
    '0589dc46-71a9-4220-baf2-d2f0dc77ef9a'
  );
INSERT INTO submissions (
    id,
    created_at,
    updated_at,
    exercise_id,
    course_id,
    exercise_item_id,
    user_id
  )
VALUES (
    'cc19e9b6-3b47-4e72-b7bc-052eb04dedc7',
    '1999-01-10',
    '1999-01-10',
    '34e47a8e-d573-43be-8f23-79128cbb29b8',
    'd86cf910-4d26-40e9-8c9c-1cc35294fdbb',
    '0125c21b-6afa-4652-89f7-56c48bd8ffe4',
    '0589dc46-71a9-4220-baf2-d2f0dc77ef9a'
  );
INSERT INTO submissions (
    id,
    created_at,
    updated_at,
    exercise_id,
    course_id,
    exercise_item_id,
    user_id
  )
VALUES (
    '2c4fd344-bdc7-42cc-83f0-8836ad752d79',
    '1999-01-11',
    '1999-01-11',
    '34e47a8e-d573-43be-8f23-79128cbb29b8',
    'd86cf910-4d26-40e9-8c9c-1cc35294fdbb',
    '0125c21b-6afa-4652-89f7-56c48bd8ffe4',
    '0589dc46-71a9-4220-baf2-d2f0dc77ef9a'
  );
UPDATE course_parts
SET page_id = 'f3b0d699-c9be-4d56-bd0a-9d40e5547e4d'
where id = 'd332f3d9-39a5-4a18-80f4-251727693c37';
UPDATE course_parts
SET page_id = 'aeac9212-b1d8-4a59-b5fb-1656606e9f5c'
where id = 'e9f24363-81ca-425b-ade2-80cc33105e75';
UPDATE pages
SET course_part_id = 'd332f3d9-39a5-4a18-80f4-251727693c37'
where id = 'f3b0d699-c9be-4d56-bd0a-9d40e5547e4d';
UPDATE pages
SET course_part_id = 'e9f24363-81ca-425b-ade2-80cc33105e75'
where id = 'aeac9212-b1d8-4a59-b5fb-1656606e9f5c';

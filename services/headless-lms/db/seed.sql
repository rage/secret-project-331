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
INSERT INTO course_instances (id, course_id)
VALUES (
    '25800692-0d99-4f29-b741-92d69b0900b9',
    'd86cf910-4d26-40e9-8c9c-1cc35294fdbb'
  );
INSERT INTO courses (id, "name", slug, organization_id)
VALUES (
    '2d56db91-399a-43e7-b6d0-21c3f18d72af',
    'Introduction to Computer Science',
    'introduction-to-computer-science',
    '1b89e57e-8b57-42f2-9fed-c7a6736e3eec'
  );
INSERT INTO course_instances (id, course_id)
VALUES (
    '049d8ef0-0d77-4fc5-8870-e215160f464c',
    '2d56db91-399a-43e7-b6d0-21c3f18d72af'
  );
INSERT INTO courses (id, "name", slug, organization_id)
VALUES (
    '8f605161-125b-449b-a443-c62ffc1b077f',
    'Introduction to Statistics',
    'introduction-to-statistics',
    'b36c94f5-bc87-4bc9-aab8-a0591b9f6f81'
  );
INSERT INTO course_instances (id, course_id)
VALUES (
    'eb5e96df-4a47-4a6e-995b-6af03f8173ad',
    '8f605161-125b-449b-a443-c62ffc1b077f'
  );
INSERT INTO pages (id, course_id, content, url_path, title)
VALUES (
    'f3b0d699-c9be-4d56-bd0a-9d40e5547e4d',
    'd86cf910-4d26-40e9-8c9c-1cc35294fdbb',
    '[{"name": "core/paragraph", "isValid": true, "clientId": "fdc9354b-4f84-4561-b5fc-b7e77fc07bad", "attributes": {"content": "Everything is a big topic.", "dropCap": false}, "innerBlocks": []}, {"name": "moocfi/exercise", "isValid": true, "clientId": "022157e6-d10c-4f87-9eb3-ee8a17c4f249", "attributes": {"id": "34e47a8e-d573-43be-8f23-79128cbb29b8"}, "innerBlocks": []}]'::jsonb,
    '/',
    'Welcome to Introduction to Everything'
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
INSERT INTO chapters(id, name, course_id, chapter_number)
VALUES (
    'd332f3d9-39a5-4a18-80f4-251727693c37',
    'The Basics',
    'd86cf910-4d26-40e9-8c9c-1cc35294fdbb',
    1
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
    exercise_item_id,
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
    exercise_item_id,
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
    exercise_item_id,
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
    exercise_item_id,
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

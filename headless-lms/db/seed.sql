INSERT INTO organizations (id, "name", slug) VALUES ('1b89e57e-8b57-42f2-9fed-c7a6736e3eec', 'University of Helsinki, Department of Computer Science', 'uh-cs');
INSERT INTO organizations (id, "name", slug) VALUES ('b36c94f5-bc87-4bc9-aab8-a0591b9f6f81', 'University of Helsinki, Department of Mathematics and Statistics', 'uh-mathstat');

INSERT INTO courses (id, "name", slug, organization_id) VALUES ('d86cf910-4d26-40e9-8c9c-1cc35294fdbb', 'Introduction to everything', 'introduction-to-everything', '1b89e57e-8b57-42f2-9fed-c7a6736e3eec');
INSERT INTO courses (id, "name", slug, organization_id) VALUES ('2d56db91-399a-43e7-b6d0-21c3f18d72af', 'Introduction to Computer Science', 'introduction-to-computer-science', '1b89e57e-8b57-42f2-9fed-c7a6736e3eec');

INSERT INTO courses (id, "name", slug, organization_id) VALUES ('8f605161-125b-449b-a443-c62ffc1b077f', 'Introduction to Statistics', 'introduction-to-statistics', 'b36c94f5-bc87-4bc9-aab8-a0591b9f6f81');

INSERT INTO pages (id, course_id, content, url_path, title) VALUES ('f3b0d699-c9be-4d56-bd0a-9d40e5547e4d', 'd86cf910-4d26-40e9-8c9c-1cc35294fdbb', '[{"name": "core/paragraph", "isValid": true, "clientId": "fdc9354b-4f84-4561-b5fc-b7e77fc07bad", "attributes": {"content": "Everything is a big topic.", "dropCap": false}, "innerBlocks": []}, {"name": "moocfi/exercise", "isValid": true, "clientId": "022157e6-d10c-4f87-9eb3-ee8a17c4f249", "attributes": {"id": "34e47a8e-d573-43be-8f23-79128cbb29b8"}, "innerBlocks": []}]'::jsonb, '/', 'Welcome to Introduction to Everything');

INSERT INTO exercises (id, course_id, "name", page_id) VALUES ('34e47a8e-d573-43be-8f23-79128cbb29b8', 'd86cf910-4d26-40e9-8c9c-1cc35294fdbb', 'Best exercise', 'f3b0d699-c9be-4d56-bd0a-9d40e5547e4d');

INSERT INTO exercise_items (id, exercise_id, exercise_type, assignment, spec) VALUES ('0125c21b-6afa-4652-89f7-56c48bd8ffe4', '34e47a8e-d573-43be-8f23-79128cbb29b8', 'example', '[{"name": "core/paragraph", "isValid": true, "clientId": "6d211c53-9a5b-47c5-a16e-5349466800cb", "attributes": {"content": "Answer this question.", "dropCap": false}, "innerBlocks": []}]'::jsonb, '[{"id": "1c206384-8373-40be-bcbd-2940c0eb5205", "name": "a", "correct": false}, {"id": "8f09e9a0-ac20-486a-ba29-704e7eeaf6af", "name": "b", "correct": true}, {"id": "af5cdeb3-7d69-4c32-9f44-d8e2aece3d02", "name": "c", "correct": false}]'::jsonb);

INSERT INTO course_parts(id, name, course_id, part_number) VALUES ('d332f3d9-39a5-4a18-80f4-251727693c37', 'The Basics', 'd86cf910-4d26-40e9-8c9c-1cc35294fdbb', 1);

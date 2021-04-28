INSERT INTO organizations (id, "name", slug) VALUES ('1b89e57e-8b57-42f2-9fed-c7a6736e3eec', 'University of Helsinki, Department of Computer Science', 'uh-cs');
INSERT INTO organizations (id, "name", slug) VALUES ('b36c94f5-bc87-4bc9-aab8-a0591b9f6f81', 'University of Helsinki, Department of Mathematics and Statistics', 'uh-mathstat');

INSERT INTO courses (id, "name", slug, organization_id) VALUES ('d86cf910-4d26-40e9-8c9c-1cc35294fdbb', 'Introduction to everything', 'introduction-to-everything', '1b89e57e-8b57-42f2-9fed-c7a6736e3eec');
INSERT INTO courses (id, "name", slug, organization_id) VALUES ('2d56db91-399a-43e7-b6d0-21c3f18d72af', 'Introduction to Computer Science', 'introduction-to-computer-science', '1b89e57e-8b57-42f2-9fed-c7a6736e3eec');

INSERT INTO courses (id, "name", slug, organization_id) VALUES ('8f605161-125b-449b-a443-c62ffc1b077f', 'Introduction to Statistics', 'introduction-to-statistics', 'b36c94f5-bc87-4bc9-aab8-a0591b9f6f81');

INSERT INTO pages (id, course_id, content, url_path, title) VALUES ('f3b0d699-c9be-4d56-bd0a-9d40e5547e4d', '8f605161-125b-449b-a443-c62ffc1b077f', '[]'::jsonb, '/', 'Welcome to Introduction to Everything');

INSERT INTO exercises (id, course_id, "name", page_id) VALUES ('34e47a8e-d573-43be-8f23-79128cbb29b8', 'd86cf910-4d26-40e9-8c9c-1cc35294fdbb', 'Best exercise', 'f3b0d699-c9be-4d56-bd0a-9d40e5547e4d');

INSERT INTO exercise_items (id, exercise_id, exercise_type) VALUES ('0125c21b-6afa-4652-89f7-56c48bd8ffe4', '34e47a8e-d573-43be-8f23-79128cbb29b8', 'example-exercise');

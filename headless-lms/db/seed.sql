INSERT INTO organizations (id, "name", slug) VALUES ('1b89e57e-8b57-42f2-9fed-c7a6736e3eec', 'University of Helsinki, Department of Computer Science', 'uh-cs');
INSERT INTO organizations (id, "name", slug) VALUES ('b36c94f5-bc87-4bc9-aab8-a0591b9f6f81', 'University of Helsinki, Department of Mathematics and Statistics', 'uh-mathstat');

INSERT INTO courses (id, "name", slug, organization_id) VALUES ('d86cf910-4d26-40e9-8c9c-1cc35294fdbb', 'Introduction to everything', 'introduction-to-everything', '1b89e57e-8b57-42f2-9fed-c7a6736e3eec');
INSERT INTO courses (id, "name", slug, organization_id) VALUES ('2d56db91-399a-43e7-b6d0-21c3f18d72af', 'Introduction to Computer Science', 'introduction-to-computer-science', '1b89e57e-8b57-42f2-9fed-c7a6736e3eec');

INSERT INTO courses (id, "name", slug, organization_id) VALUES ('8f605161-125b-449b-a443-c62ffc1b077f', 'Introduction to Statistics', 'introduction-to-statistics', 'b36c94f5-bc87-4bc9-aab8-a0591b9f6f81');

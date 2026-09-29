UPDATE email_templates t
SET deleted_at = NOW()
FROM (
  VALUES (
      'credit_registration_action_needed'::email_template_type,
      'en',
      'Enrol on the course to get your credits registered',
      '[
        {"type": "core/paragraph", "isValid": true, "clientId": "d3000000-0000-0000-0000-000000000001", "attributes": {"content": "Hello, you have completed {{COURSE_NAME}} ({{CREDITS}} credits). To register your credits in Sisu, you need to be enrolled on the course. We cannot find an enrolment for you yet.", "drop_cap": false}, "innerBlocks": []},
        {"type": "core/paragraph", "isValid": true, "clientId": "d3000000-0000-0000-0000-000000000002", "attributes": {"content": "If you have not enrolled yet, please enrol. {{ENROLMENT_LINK}}", "drop_cap": false}, "innerBlocks": []},
        {"type": "core/paragraph", "isValid": true, "clientId": "d3000000-0000-0000-0000-000000000003", "attributes": {"content": "We check regularly and register your credits automatically once we can see your enrolment. If you have enrolled, you do not need to do anything else.", "drop_cap": false}, "innerBlocks": []},
        {"type": "core/paragraph", "isValid": true, "clientId": "d3000000-0000-0000-0000-000000000004", "attributes": {"content": "You can see the details and how to enrol here: {{STATUS_LINK}}", "drop_cap": false}, "innerBlocks": []}
      ]'::jsonb
    ),
    (
      'credit_registration_action_needed'::email_template_type,
      'fi',
      'Ilmoittaudu kurssille, jotta voimme kirjata opintopisteesi',
      '[
        {"type": "core/paragraph", "isValid": true, "clientId": "d4000000-0000-0000-0000-000000000001", "attributes": {"content": "Hei, olet suorittanut kurssin {{COURSE_NAME}} ({{CREDITS}} op). Jotta voimme kirjata opintopisteesi Sisuun, sinun pitää olla ilmoittautunut kurssille. Emme vielä löydä ilmoittautumistasi.", "drop_cap": false}, "innerBlocks": []},
        {"type": "core/paragraph", "isValid": true, "clientId": "d4000000-0000-0000-0000-000000000002", "attributes": {"content": "Jos et ole vielä ilmoittautunut, ilmoittaudu kurssille. {{ENROLMENT_LINK}}", "drop_cap": false}, "innerBlocks": []},
        {"type": "core/paragraph", "isValid": true, "clientId": "d4000000-0000-0000-0000-000000000003", "attributes": {"content": "Tarkistamme tilanteen säännöllisesti ja kirjaamme opintopisteesi automaattisesti, kun näemme ilmoittautumisesi. Jos olet jo ilmoittautunut, sinun ei tarvitse tehdä muuta.", "drop_cap": false}, "innerBlocks": []},
        {"type": "core/paragraph", "isValid": true, "clientId": "d4000000-0000-0000-0000-000000000004", "attributes": {"content": "Näet tarkemmat tiedot ja ilmoittautumisohjeet täältä: {{STATUS_LINK}}", "drop_cap": false}, "innerBlocks": []}
      ]'::jsonb
    ),
    (
      'credit_registration_registered'::email_template_type,
      'en',
      'Your credits have been registered',
      '[
        {"type": "core/paragraph", "isValid": true, "clientId": "d5000000-0000-0000-0000-000000000001", "attributes": {"content": "Hello, your credits for {{COURSE_NAME}} ({{CREDITS}} credits) are now registered in Sisu.", "drop_cap": false}, "innerBlocks": []},
        {"type": "core/paragraph", "isValid": true, "clientId": "d5000000-0000-0000-0000-000000000002", "attributes": {"content": "If they were already registered, this email confirms it. You can see the details here: {{STATUS_LINK}}", "drop_cap": false}, "innerBlocks": []}
      ]'::jsonb
    ),
    (
      'credit_registration_registered'::email_template_type,
      'fi',
      'Opintopisteesi on kirjattu',
      '[
        {"type": "core/paragraph", "isValid": true, "clientId": "d6000000-0000-0000-0000-000000000001", "attributes": {"content": "Hei, kurssin {{COURSE_NAME}} opintopisteesi ({{CREDITS}} op) on nyt kirjattu Sisuun.", "drop_cap": false}, "innerBlocks": []},
        {"type": "core/paragraph", "isValid": true, "clientId": "d6000000-0000-0000-0000-000000000002", "attributes": {"content": "Jos ne oli jo kirjattu, tämä viesti vahvistaa sen. Näet tiedot täältä: {{STATUS_LINK}}", "drop_cap": false}, "innerBlocks": []}
      ]'::jsonb
    )
  ) AS seed(email_template_type, language, subject, content)
WHERE t.email_template_type = seed.email_template_type
  AND t.language = seed.language
  AND t.subject = seed.subject
  AND t.content = seed.content
  AND t.course_id IS NULL
  AND t.deleted_at IS NULL;

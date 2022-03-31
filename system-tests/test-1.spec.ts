import { test, expect } from '@playwright/test';

test('test', async ({ page }) => {

  // Go to https://www.google.com/search?q=project-331.local&oq=project-331.local&aqs=chrome..69i57.4206j0j2&sourceid=chrome&ie=UTF-8
  await page.goto('https://www.google.com/search?q=project-331.local&oq=project-331.local&aqs=chrome..69i57.4206j0j2&sourceid=chrome&ie=UTF-8');

  // Go to http://project-331.local/
  await page.goto('http://project-331.local/');

  // Click [aria-label="University\ of\ Helsinki\,\ Department\ of\ Computer\ Science"] div:has-text("University of Helsinki, Department of Computer ScienceOrganization for Computer ") >> nth=0
  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/org/uh-cs' }*/),
    page.locator('[aria-label="University\\ of\\ Helsinki\\,\\ Department\\ of\\ Computer\\ Science"] div:has-text("University of Helsinki, Department of Computer ScienceOrganization for Computer ")').first().click()
  ]);

  // Click text=Advanced course instance management
  await Promise.all([
    page.waitForNavigation(/*{ url: 'http://project-331.local/org/uh-cs/courses/advanced-course-instance-management' }*/),
    page.locator('text=Advanced course instance management').click()
  ]);

});
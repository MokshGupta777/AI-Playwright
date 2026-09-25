import { test as base } from '@playwright/test';
import { LoginAssertions } from '../assertions/LoginAssertions';
import { LoginFlow } from '../flows/LoginFlow';
import { LoginPage } from '../pages/LoginPage';

type AppFixtures = {
  loginPage: LoginPage;
  loginFlow: LoginFlow;
  loginAssertions: LoginAssertions;
};

export const test = base.extend<AppFixtures>({
  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },

  loginFlow: async ({ loginPage }, use) => {
    await use(new LoginFlow(loginPage));
  },

  loginAssertions: async ({ loginPage }, use) => {
    await use(new LoginAssertions(loginPage));
  },
});

export { expect } from '@playwright/test';

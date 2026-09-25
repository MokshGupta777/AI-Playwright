import { expect, Locator } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';

export class LoginAssertions {
  constructor(private readonly loginPage: LoginPage) {}

  async shouldSeeLoginPage(): Promise<void> {
    await expect(this.loginPage.loginHeading).toBeVisible();
  }

  async shouldBeLoggedIn(): Promise<void> {
    await expect(this.loginPage.loggedInLabel).toBeVisible();
  }

  async shouldSeeInvalidLoginError(): Promise<void> {
    await expect(this.loginPage.loginError).toBeVisible();
  }

  async fieldShouldBeRequired(field: Locator): Promise<void> {
    await expect(field).toHaveAttribute('required', '');
  }
}

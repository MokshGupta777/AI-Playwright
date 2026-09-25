import { Locator, Page } from '@playwright/test';
import { routes } from '../config/routes';
import { messages } from '../constants/messages';

export class LoginPage {
  readonly loginHeading: Locator;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly loginButton: Locator;
  readonly logoutButton: Locator;
  readonly loggedInLabel: Locator;
  readonly loginError: Locator;
 
  constructor(private readonly page: Page) {
    this.loginHeading = page.locator('h2', { hasText: messages.loginPageHeading });
    this.emailInput = page.locator('input[data-qa="login-email"]');
    this.passwordInput = page.locator('input[data-qa="login-password"]');
    this.loginButton = page.locator('button[data-qa="login-button"]');
    this.logoutButton = page.locator('a[href="/logout"]');
    this.loggedInLabel = page.locator('a', { hasText: messages.loggedInLabel });
    this.loginError = page.locator('p', { hasText: messages.invalidLogin });
  }

  async open(): Promise<void> {
    await this.page.goto(routes.login);
  }

  async enterEmail(email: string): Promise<void> {
    await this.emailInput.fill(email);
  }

  async enterPassword(password: string): Promise<void> {
    await this.passwordInput.fill(password);
  }

  async clickLogin(): Promise<void> {
    await this.loginButton.click();
  }

  async clickLogout(): Promise<void> {
    await this.logoutButton.click();
  }
}

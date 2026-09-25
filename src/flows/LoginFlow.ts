import { LoginPage } from '../pages/LoginPage';

export class LoginFlow {
  constructor(private readonly loginPage: LoginPage) {}

  async openLoginPage(): Promise<void> {
    await this.loginPage.open();
  }

  async login(email: string, password: string): Promise<void> {
    await this.openLoginPage();
    await this.loginPage.enterEmail(email);
    await this.loginPage.enterPassword(password);
    await this.loginPage.clickLogin();
  }

  async logout(): Promise<void> {
    await this.loginPage.clickLogout();
  }
}

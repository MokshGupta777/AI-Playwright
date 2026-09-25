import { test } from '../../src/fixtures/testFixtures';
import { users } from '../../src/data/users';

test.describe('Login feature', () => {
  test('@smoke should login with valid credentials', async ({ loginFlow, loginAssertions }) => {
    await loginFlow.login(users.validUser.email, users.validUser.password);
    await loginAssertions.shouldBeLoggedIn();
  });

  test('should show error for invalid credentials', async ({ loginFlow, loginAssertions }) => {
    await loginFlow.login(users.invalidUser.email, users.invalidUser.password);
    await loginAssertions.shouldSeeInvalidLoginError();
  });

  test('should keep email and password fields required', async ({ loginFlow, loginPage, loginAssertions }) => {
    await loginFlow.openLoginPage();
    await loginAssertions.shouldSeeLoginPage();
    await loginAssertions.fieldShouldBeRequired(loginPage.emailInput);
    await loginAssertions.fieldShouldBeRequired(loginPage.passwordInput);
  });

  test('should logout after successful login', async ({ loginFlow, loginAssertions }) => {
    await loginFlow.login(users.validUser.email, users.validUser.password);
    await loginAssertions.shouldBeLoggedIn();
    await loginFlow.logout();
    await loginAssertions.shouldSeeLoginPage();
  });
});

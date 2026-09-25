import { env } from '../config/env';

export const users = {
  validUser: {
    email: env.userEmail,
    password: env.userPassword,
  },
  invalidUser: {
    email: 'wrong@mail.com',
    password: 'wrongpass',
  },
};

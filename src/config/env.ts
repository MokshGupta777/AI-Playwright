import * as dotenv from 'dotenv';

dotenv.config();

function getRequiredEnv(key: string): string {
  const value = process.env[key]?.trim();
  if (!value) {
    throw new Error(`Missing environment variable: ${key}`);
  }
  return value;
}

function getOptionalEnv(key: string, fallback = ''): string {
  return process.env[key]?.trim() || fallback;
}

export const env = {
  baseUrl: getRequiredEnv('BASE_URL'),
  apiUrl: getOptionalEnv('API_URL'),
  userEmail: getRequiredEnv('USER_EMAIL'),
  userPassword: getRequiredEnv('USER_PASSWORD'),
};

export type TUser = { name: string; email: string };
export type TCredentials = { email: string; password: string };
export type TRegistration = TCredentials & { name: string };
export type TTokens = { accessToken: string; refreshToken: string };
export type TAuthResponse = TTokens & { success: true; user: TUser };
export type TUserResponse = { success: true; user: TUser };
export type TTokenResponse = TTokens & { success: true };

export const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

export const isUserResponse = (value: unknown): value is TUserResponse =>
  isObject(value) &&
  value.success === true &&
  isObject(value.user) &&
  typeof value.user.name === 'string' &&
  typeof value.user.email === 'string';

export const isTokenResponse = (value: unknown): value is TTokenResponse =>
  isObject(value) &&
  value.success === true &&
  typeof value.accessToken === 'string' &&
  /^Bearer\s+\S+$/.test(value.accessToken) &&
  typeof value.refreshToken === 'string' &&
  value.refreshToken.trim().length > 0;

export const isAuthResponse = (value: unknown): value is TAuthResponse =>
  isUserResponse(value) && isTokenResponse(value);

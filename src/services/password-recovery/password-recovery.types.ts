import { isObject } from '@services/auth/auth.types';

export type TPasswordResetEmailRequest = { email: string };
export type TPasswordResetRequest = { password: string; token: string };
export type TPasswordRecoveryResponse = { success: true; message: string };

export const isPasswordRecoveryResponse = (
  value: unknown
): value is TPasswordRecoveryResponse =>
  isObject(value) && value.success === true && typeof value.message === 'string';

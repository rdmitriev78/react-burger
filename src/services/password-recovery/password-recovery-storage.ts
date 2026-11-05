const passwordResetKey = 'passwordResetRequested';

export const passwordRecoveryStorageErrorMessage =
  'Не удалось сохранить или проверить шаг восстановления. Проверьте настройки браузера и повторите попытку.';

export const hasPasswordResetRequest = (): boolean =>
  localStorage.getItem(passwordResetKey) === 'true';

export const markPasswordResetRequested = (): void => {
  localStorage.setItem(passwordResetKey, 'true');
};

export const clearPasswordResetRequest = (): void => {
  localStorage.removeItem(passwordResetKey);
};

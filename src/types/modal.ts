// Необходим title или ariaLabel (или оба) для работы скринридера.
export type TModalTitleOrAriaLabel =
  | { title: string; ariaLabel?: string }
  | { title?: string; ariaLabel: string };

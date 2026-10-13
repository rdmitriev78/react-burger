// Определение виртуальной активации по примеру React Aria:
// https://github.com/adobe/react-spectrum/blob/main/packages/react-aria/src/utils/isVirtualEvent.ts
export const isVirtualClick = (event: MouseEvent | PointerEvent): boolean => {
  const pointerType = 'pointerType' in event ? event.pointerType : undefined;

  // Firefox с JAWS/NVDA может передавать ненулевой detail.
  if (event.isTrusted && pointerType === '') return true;

  // У Android TalkBack виртуальный click может содержать pointerType и buttons = 1.
  const isAndroid =
    typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent);
  if (isAndroid && pointerType) return event.type === 'click' && event.buttons === 1;

  return event.detail === 0 && !pointerType;
};

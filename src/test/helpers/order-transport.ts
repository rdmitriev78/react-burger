import { vi } from 'vitest';

import { testIngredients } from '../fixtures/ingredients/ingredients';
import { publicSnapshot } from '../fixtures/orders/order-streams';
import { FakeWebSocket } from './fake-websocket';

export const installOrderTransport = (
  snapshot: unknown = publicSnapshot
): ReturnType<typeof vi.fn<typeof fetch>> => {
  FakeWebSocket.instances = [];
  FakeWebSocket.onCreate = (socket): void => {
    queueMicrotask(() => {
      if (socket.readyState === 3) return;
      socket.open();
      socket.receive(snapshot);
    });
  };
  vi.stubGlobal('WebSocket', FakeWebSocket);
  const transport = vi.fn<typeof fetch>((input) => {
    const url = input instanceof Request ? input.url : String(input);
    const body = url.endsWith('/ingredients')
      ? { success: true, data: testIngredients }
      : url.includes('/auth/')
        ? {
            success: true,
            user: { name: 'Тест', email: 'test@example.test' },
            accessToken: 'Bearer test',
            refreshToken: 'refresh',
          }
        : { success: false, message: 'Order not found' };
    return Promise.resolve(
      new Response(JSON.stringify(body), {
        status: url.includes('/orders/') ? 404 : 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );
  });
  vi.stubGlobal('fetch', transport);
  return transport;
};

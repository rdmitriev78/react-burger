export type TOrderResult = {
  orderNumber: number;
  name: string;
};

// stopped означает прекращение ожидания, а не подтверждённую отмену заказа на сервере.
export type TOrderState =
  | { status: 'idle' }
  | { status: 'submitting' }
  | { status: 'success'; orderResult: TOrderResult }
  | { status: 'error'; message: string }
  | { status: 'stopped' };

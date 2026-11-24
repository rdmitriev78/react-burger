export class FakeWebSocket extends EventTarget {
  static instances: FakeWebSocket[] = [];
  static onCreate: ((socket: FakeWebSocket) => void) | undefined;
  readonly url: string;
  readyState = 0;

  constructor(url: string | URL) {
    super();
    this.url = String(url);
    FakeWebSocket.instances.push(this);
    FakeWebSocket.onCreate?.(this);
  }

  open(): void {
    this.readyState = 1;
    this.dispatchEvent(new Event('open'));
  }

  receive(data: unknown): void {
    this.receiveText(JSON.stringify(data));
  }

  receiveText(data: string): void {
    this.dispatchEvent(new MessageEvent('message', { data }));
  }

  close(): void {
    this.readyState = 3;
    this.dispatchEvent(new Event('close'));
  }

  fail(): void {
    this.dispatchEvent(new Event('error'));
    this.close();
  }
}

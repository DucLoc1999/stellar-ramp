import crypto from 'crypto';

export async function fireCallback(
  callbackUrl: string,
  orderId: string | number,
  oldState: number,
  newState: number,
): Promise<void> {
  try {
    await fetch(callbackUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: crypto.randomUUID(),
        topic: 'order.state.change',
        ts: new Date().toISOString(),
        payload: {
          order_id: String(orderId),
          old_order_state: oldState,
          new_order_state: newState,
        },
      }),
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    // best-effort — don't block order processing
  }
}

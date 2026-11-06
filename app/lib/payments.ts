export type PaymentStatus = "pending" | "paid";

export type PaymentRecord = {
  customId: string;
  courseSlug: string;
  amount: number;
  status: PaymentStatus;
  chargeId: string | null;
  checkoutUrl: string | null;
  entity: string | null;
  reference: string | null;
  expiresAt: string | null;
  transactionReceipt: string | null;
  paidAt: string | null;
};

type TestPaymentStore = {
  payments: Map<string, PaymentRecord>;
  webhookEvents: Map<string, string>;
};

const globalForPayments = globalThis as typeof globalThis & {
  kitadiTestPaymentStore?: TestPaymentStore;
};

if (!globalForPayments.kitadiTestPaymentStore) {
  globalForPayments.kitadiTestPaymentStore = {
    payments: new Map(),
    webhookEvents: new Map(),
  };
}

const store = globalForPayments.kitadiTestPaymentStore;
const MAX_TEST_PAYMENTS = 500;

export function createPayment(record: PaymentRecord) {
  if (store.payments.size >= MAX_TEST_PAYMENTS) {
    const oldestId = store.payments.keys().next().value;
    if (oldestId) {
      const oldest = store.payments.get(oldestId);
      if (oldest) {
        for (const [eventId, customId] of store.webhookEvents) {
          if (customId === oldest.customId) {
            store.webhookEvents.delete(eventId);
          }
        }
      }
      store.payments.delete(oldestId);
    }
  }

  store.payments.set(record.customId, record);
}

export function getPayment(customId: string) {
  return store.payments.get(customId);
}

export function removePayment(customId: string) {
  store.payments.delete(customId);
}

export function markPaymentPaid({
  customId,
  eventId,
  transactionReceipt,
  paidAt,
}: {
  customId: string;
  eventId: string;
  transactionReceipt: string | null;
  paidAt: string;
}) {
  const payment = store.payments.get(customId);

  if (!payment) return "not-found" as const;
  if (payment.status === "paid" || store.webhookEvents.has(eventId)) {
    return "duplicate" as const;
  }

  payment.status = "paid";
  payment.transactionReceipt = transactionReceipt;
  payment.paidAt = paidAt;
  store.webhookEvents.set(eventId, customId);

  return "updated" as const;
}

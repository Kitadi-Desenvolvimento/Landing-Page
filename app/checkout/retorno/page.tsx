import Link from "next/link";
import {
  getOrder,
  isKitadiReference,
  updateOrder,
} from "../../lib/payments/orders";
import PaymentStatus from "./status";

export const dynamic = "force-dynamic";

export default async function CheckoutReturnPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; reference?: string }>;
}) {
  const params = await searchParams;
  const reference = params.reference?.trim() ?? "";
  let order = isKitadiReference(reference) ? await getOrder(reference) : null;

  if (
    params.status === "success" &&
    order?.paymentProvider === "wipay" &&
    order.status === "pending"
  ) {
    order = await updateOrder(reference, {
      status: "accepted",
      providerStatus: "test_return_success",
      reason: null,
      paidAt: new Date().toISOString(),
    });
  }

  const confirmed = order?.status === "accepted";
  const rejected =
    order?.status === "rejected" ||
    order?.status === "expired" ||
    order?.status === "canceled";

  const initialStatus = confirmed ? "accepted" : rejected ? "rejected" : "pending";

  return (
    <main className="min-h-svh text-[#211d1e]">
      <section
        className="px-5 py-16 text-white sm:px-8"
        style={{
          background:
            "linear-gradient(110deg, #510f1d 0%, #3b0a15 47%, #28070d 100%)",
        }}
      >
        <div className="mx-auto max-w-[720px]">
          <p className="text-sm font-medium text-[#cda45c]">Checkout Kitadi</p>
          <PaymentStatus
            initialStatus={initialStatus}
            reference={order?.reference ?? ""}
          />
        </div>
      </section>
      <section className="px-5 py-10 sm:px-8">
        <div className="mx-auto max-w-[720px] rounded-[28px] border border-[#e7e1df] bg-white p-6 sm:p-8">
          {order && (
            <p className="text-sm text-[#716a69]">
              Referência{" "}
              <span className="font-medium text-[#211d1e]">{order.reference}</span>
              {" · "}
              {new Intl.NumberFormat("pt-AO").format(order.amountKz)} Kz
            </p>
          )}
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              className="inline-flex min-h-[46px] items-center justify-center rounded-full bg-[#cda45c] px-6 text-sm font-medium !text-[#2b160f]"
              href="/produtos"
            >
              Voltar aos produtos
            </Link>
            <Link
              className="inline-flex min-h-[46px] items-center justify-center rounded-full border border-[#e7e1df] px-6 text-sm font-medium text-[#211d1e]"
              href="/"
            >
              Ir para o início
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

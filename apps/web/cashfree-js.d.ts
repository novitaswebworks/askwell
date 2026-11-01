// @cashfreepayments/cashfree-js ships no types. Only what we call is declared.
declare module "@cashfreepayments/cashfree-js" {
  export interface Cashfree {
    subscriptionsCheckout(options: {
      subsSessionId: string;
      redirectTarget?: "_self" | "_blank" | "_top" | "_modal";
    }): Promise<{ error?: { message?: string } } | undefined>;
  }

  export function load(options: { mode: "sandbox" | "production" }): Promise<Cashfree | null>;
}

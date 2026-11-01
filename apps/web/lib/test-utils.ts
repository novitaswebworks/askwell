// Test helper: a Supabase query builder stand-in. Every method returns the same
// builder, and awaiting it (or .single() / .maybeSingle()) yields `result`.
export function queryResult(result: { data?: unknown; error?: unknown }) {
  const builder: unknown = new Proxy(
    {},
    {
      get: (_target, prop) =>
        prop === "then"
          ? (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
              Promise.resolve({ data: null, error: null, ...result }).then(resolve, reject)
          : () => builder,
    },
  );
  return builder;
}

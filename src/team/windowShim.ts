// The v1 engines are classic browser scripts that attach themselves to `window`.
// In Node (Vitest) there is no window, so alias it to globalThis before they load.
const g = globalThis as unknown as { window?: unknown };
if (typeof g.window === 'undefined') g.window = globalThis;
export {};

const PADDLE_JS = "https://cdn.paddle.com/paddle/v2/paddle.js";

export type PaddleWindow = {
  Paddle?: {
    Environment: { set: (e: string) => void };
    Initialize: (o: { token: string }) => void;
    Checkout: { open: (o: Record<string, unknown>) => void };
  };
};

/** Load Paddle.js once; safe to call from multiple CTAs. */
export function loadPaddleJs(): Promise<NonNullable<PaddleWindow["Paddle"]>> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Paddle.js can only load in the browser"));
  }
  const w = window as unknown as PaddleWindow;
  if (w.Paddle) return Promise.resolve(w.Paddle);

  const existing = document.querySelector<HTMLScriptElement>(
    `script[data-delvix-paddle="1"]`
  );
  if (existing) {
    return new Promise((resolve, reject) => {
      if (w.Paddle) {
        resolve(w.Paddle);
        return;
      }
      existing.addEventListener("load", () => {
        if (w.Paddle) resolve(w.Paddle);
        else reject(new Error("Paddle.js loaded but Paddle global missing"));
      });
      existing.addEventListener("error", () =>
        reject(
          new Error(
            "Failed to load Paddle.js (blocked). Disable ad blockers, hard-refresh, and ensure the app was rebuilt after CSP update."
          )
        )
      );
    });
  }

  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = PADDLE_JS;
    s.async = true;
    s.dataset.delvixPaddle = "1";
    s.onload = () => {
      if (w.Paddle) resolve(w.Paddle);
      else
        reject(new Error("Paddle.js loaded but Paddle global missing"));
    };
    s.onerror = () =>
      reject(
        new Error(
          "Failed to load Paddle.js from cdn.paddle.com. Usually: (1) app not rebuilt after CSP fix, (2) ad blocker / Brave Shields, or (3) nginx CSP overriding Next. Open the URL in a new tab to verify."
        )
      );
    document.head.appendChild(s);
  });
}

export { PADDLE_JS };

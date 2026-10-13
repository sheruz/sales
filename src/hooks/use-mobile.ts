import * as React from "react";

/** Match Delvix reference: drawer below ~860px */
const MOBILE_BREAKPOINT = 860;

function subscribe(callback: () => void) {
  const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
  mql.addEventListener("change", callback);
  return () => mql.removeEventListener("change", callback);
}

function getSnapshot() {
  return window.innerWidth < MOBILE_BREAKPOINT;
}

function getServerSnapshot() {
  return false;
}

/**
 * Mobile detection that matches SSR during hydration (always false on server /
 * first hydrate), then updates. Avoids React #418 text/tree mismatches.
 */
export function useIsMobile() {
  const isMobile = React.useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot
  );
  const [ready, setReady] = React.useState(false);
  React.useEffect(() => {
    setReady(true);
  }, []);
  // Keep server tree until after mount so mobile clients don't hydrate a different DOM
  if (!ready) return false;
  return isMobile;
}

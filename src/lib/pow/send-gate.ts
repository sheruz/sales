/**
 * PoW send safety — executor must refuse until PoW3 enables POW_SEND_ENABLED.
 * Reads process.env directly so unit tests don't need full env bootstrap.
 */

function envFlagTrue(name: string): boolean {
  const t = String(process.env[name] ?? "")
    .trim()
    .toLowerCase();
  return t === "true" || t === "1" || t === "yes";
}

export function isPowSendEnabled(): boolean {
  return envFlagTrue("POW_SEND_ENABLED");
}

export function assertPowSendAllowed(sequence: {
  isProofOfWork?: boolean | null;
  name?: string | null;
}): void {
  const isPow =
    Boolean(sequence.isProofOfWork) ||
    String(sequence.name || "").toLowerCase() === "proof of work";
  if (!isPow) return;
  if (!isPowSendEnabled()) {
    throw new Error(
      "Proof of Work sequences cannot send until PoW3 (POW_SEND_ENABLED=false)"
    );
  }
}

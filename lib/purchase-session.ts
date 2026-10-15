/**
 * Compra segura: estado independiente del inventario.
 * Marcar artículos nunca confirma una compra ni aumenta existencias.
 */
export type PurchaseStatus = "draft" | "shopping" | "pending" | "confirmed" | "archived";
export type PurchaseLine = { id: string; productId?: string; name: string; quantity: number; picked: boolean };
export type PurchaseSession = {
  id: string; householdId: string; startedAt: string; status: PurchaseStatus;
  lines: PurchaseLine[]; receiptFingerprints: string[]; confirmedAt?: string;
};
export type PurchaseEvent = { sessionId: string; type: "confirmed"; at: string; lineId: string; quantity: number };

export function shouldOfferExitReminder(session: PurchaseSession, locationPermission: boolean): boolean {
  return locationPermission && (session.status === "shopping" || session.status === "pending")
    && new Set(session.lines.filter(x => x.picked).map(x => x.id)).size >= 3;
}

export function markPurchasePending(session: PurchaseSession): PurchaseSession {
  if (session.status === "confirmed" || session.status === "archived") return session;
  return { ...session, status: "pending" };
}

/** Idempotent: an already confirmed purchase never emits additional inventory events. */
export function confirmPurchase(session: PurchaseSession, at: string): { session: PurchaseSession; events: PurchaseEvent[] } {
  if (session.status === "confirmed" || session.status === "archived") return { session, events: [] };
  const events = session.lines.filter(x => x.picked && x.quantity > 0 && Number.isFinite(x.quantity))
    .map(x => ({ sessionId: session.id, type: "confirmed" as const, at, lineId: x.id, quantity: x.quantity }));
  return { session: { ...session, status: "confirmed", confirmedAt: at }, events };
}

/** Receipts can be attached before or after confirmation, without generating stock events. */
export function attachReceiptFingerprint(session: PurchaseSession, fingerprint: string): PurchaseSession {
  if (!fingerprint.trim() || session.receiptFingerprints.includes(fingerprint)) return session;
  return { ...session, receiptFingerprints: [...session.receiptFingerprints, fingerprint] };
}

/** Never discard an unconfirmed purchase when a new session begins. */
export function pendingSessions(sessions: PurchaseSession[]): PurchaseSession[] {
  return sessions.filter(x => x.status === "pending" || x.status === "shopping");
}

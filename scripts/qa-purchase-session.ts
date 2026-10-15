import { attachReceiptFingerprint, confirmPurchase, markPurchasePending, pendingSessions, shouldOfferExitReminder, type PurchaseSession } from "../lib/purchase-session";

function check(ok: unknown, message: string) { if (!ok) throw new Error(message); }
const base: PurchaseSession = {
 id: "purchase-1", householdId: "home-1", startedAt: "2026-10-15T10:00:00",
 status: "shopping", receiptFingerprints: [],
 lines: [
  { id: "a", name: "Brócoli", quantity: 1, picked: true },
  { id: "b", name: "Leche", quantity: 2, picked: true },
  { id: "c", name: "Yogur", quantity: 4, picked: true },
  { id: "d", name: "Pan", quantity: 1, picked: false },
 ]
};
check(!shouldOfferExitReminder(base, false), "Location consent required");
check(shouldOfferExitReminder(base, true), "Three picked lines enable reminder eligibility");
check(!shouldOfferExitReminder({ ...base, lines: base.lines.slice(0, 2) }, true), "Two lines are insufficient");
const pending = markPurchasePending(base);
check(pendingSessions([pending]).length === 1, "Pending session preserved");
const first = confirmPurchase(pending, "2026-10-15T11:00:00");
check(first.events.length === 3, "Only picked items produce events");
check(confirmPurchase(first.session, "2026-10-15T12:00:00").events.length === 0, "Repeat confirmation idempotent");
const withReceipt = attachReceiptFingerprint(first.session, "ticket-abc");
check(attachReceiptFingerprint(withReceipt, "ticket-abc").receiptFingerprints.length === 1, "Duplicate ticket fingerprint ignored");
check(confirmPurchase(withReceipt, "2026-10-15T12:00:00").events.length === 0, "Late ticket never duplicates stock");
check(pendingSessions([pending, base, withReceipt]).length === 2, "Old pending sessions not removed");
console.log("purchase-session checks passed");

let rejectedEmpty = false;
try { confirmPurchase({ ...base, lines: base.lines.map(x => ({ ...x, picked: false })) }, "2026-10-15T12:00:00"); }
catch (e) { rejectedEmpty = (e as Error).message === "purchase_has_no_confirmed_lines"; }
check(rejectedEmpty, "Empty purchase confirmation rejected");
let rejectedDuplicate = false;
try { confirmPurchase({ ...base, lines: [base.lines[0], base.lines[0]] }, "2026-10-15T12:00:00"); }
catch (e) { rejectedDuplicate = (e as Error).message === "duplicate_purchase_line_id"; }
check(rejectedDuplicate, "Duplicate line identifiers rejected");

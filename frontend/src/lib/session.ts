import { v4 as uuidv4 } from "uuid";

export type SessionSlot = "a" | "b";

function sessionStorageKey(slot: SessionSlot): string {
  return `dma_session_${slot}_id`;
}

export function getSessionId(slot: SessionSlot = "a"): string {
  const key = sessionStorageKey(slot);
  let id = localStorage.getItem(key);

  if (!id) {
    id = uuidv4();
    localStorage.setItem(key, id);
  }

  return id;
}

export function getBrowserId(): string {
  let id = localStorage.getItem("dma_browser_id");

  if (!id) {
    id = uuidv4();
    localStorage.setItem("dma_browser_id", id);
  }

  return id;
}

export function resetSession(slot: SessionSlot = "a"): void {
  localStorage.removeItem(sessionStorageKey(slot));
  window.location.reload();
}

export function resetAllSessions(): void {
  localStorage.removeItem(sessionStorageKey("a"));
  localStorage.removeItem(sessionStorageKey("b"));
  window.location.reload();
}

export function rotateSession(slot: SessionSlot): string {
  localStorage.removeItem(sessionStorageKey(slot));
  return getSessionId(slot);
}

import { v4 as uuidv4 } from "uuid";

export function getSessionId(): string {
  let id = localStorage.getItem("dma_session_id");

  if (!id) {
    id = uuidv4();
    localStorage.setItem("dma_session_id", id);
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

export function resetSession(): void {
  localStorage.removeItem("dma_session_id");
  window.location.reload();
}

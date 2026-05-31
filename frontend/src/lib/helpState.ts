const HELP_SEEN_KEY = "mgp_help_seen";

export function hasSeenHelp(): boolean {
  return localStorage.getItem(HELP_SEEN_KEY) === "true";
}

export function markHelpSeen(): void {
  localStorage.setItem(HELP_SEEN_KEY, "true");
}

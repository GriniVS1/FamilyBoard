// Captures the one-shot "#pair=<installationId>.<code>" arrival hash before
// the router ever sees it, so the code never lingers in the address bar
// (browser history, back button, screenshots, etc).

let arrival = null;

export function consumeArrivalHashIfPresent() {
  const hash = location.hash;
  const match = /^#pair=([^.]+)\.(.+)$/.exec(hash);
  if (!match) return;
  arrival = { installationId: match[1], code: decodeURIComponent(match[2]) };
  history.replaceState(null, "", `${location.pathname}${location.search}#/pair`);
}

export function getArrivalPair() {
  return arrival;
}

export function clearArrivalPair() {
  arrival = null;
}

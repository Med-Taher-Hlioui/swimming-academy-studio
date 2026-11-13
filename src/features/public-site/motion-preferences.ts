type DataConnection = EventTarget & { saveData?: boolean };
const preferenceQueries = ["(prefers-reduced-motion: reduce)", "(prefers-reduced-data: reduce)"];

function connection() {
  return (navigator as Navigator & { connection?: DataConnection }).connection;
}

export function staticPreferred() {
  return preferenceQueries.some(query => window.matchMedia(query).matches) || connection()?.saveData === true;
}

export function subscribePreferences(changed: () => void) {
  const queries = preferenceQueries.map(query => window.matchMedia(query));
  queries.forEach(query => query.addEventListener("change", changed));
  const network = connection();
  network?.addEventListener("change", changed);
  return () => {
    queries.forEach(query => query.removeEventListener("change", changed));
    network?.removeEventListener("change", changed);
  };
}

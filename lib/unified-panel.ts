export function unifiedPanelRoute(hashRoute: string): string {
  const normalized = hashRoute.startsWith('/') ? hashRoute : `/${hashRoute}`;
  return normalized;
}

export default function Loading() {
  return (
    <div className="app-route-loading route-loader" role="status" aria-live="polite" aria-busy="true">
      <div className="route-loader__panel">
        <div className="route-loader__orbit route-loader__orbit--outer" />
        <div className="route-loader__orbit route-loader__orbit--inner" />
        <div className="route-loader__logo">
          <div className="h-[76px] w-[76px] rounded-2xl bg-slate-800/90" />
        </div>
        <h2 className="route-loader__title">SocialFlow Orbit</h2>
        <p className="route-loader__subtitle">Syncing your automation workspace...</p>
        <div className="route-loader__progress" aria-hidden="true">
          <span />
        </div>
        <div className="route-loader__dots" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      </div>
    </div>
  );
}

import React from "react";

export function HoloPanel({ children, className = "", accent = false, title, badge, "data-testid": testId }) {
  return (
    <div
      data-testid={testId}
      className={`holo-panel ${accent ? "holo-panel--accent" : ""} p-4 relative ${className}`}
    >
      <span className="holo-panel-corner tl" />
      <span className="holo-panel-corner tr" />
      <span className="holo-panel-corner bl" />
      <span className="holo-panel-corner br" />
      {title && (
        <div className="flex items-center justify-between mb-3">
          <h3 className="holo-label">{title}</h3>
          {badge && <span className="tag-pill text-cyan-300">{badge}</span>}
        </div>
      )}
      {children}
    </div>
  );
}

export default HoloPanel;

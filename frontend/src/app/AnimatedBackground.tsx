// AnimatedBackground — slow gradient mesh behind all glass layers

import React from "react";

export function AnimatedBackground() {
  return (
    <div className="mesh-bg" aria-hidden="true">
      <div className="mesh-orb-3" />
      <div className="mesh-orb-4" />
    </div>
  );
}

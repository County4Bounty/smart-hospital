import React from 'react';

export default function AiInsights() {
  return <div className="v-view">
    <div className="section-heading v-page-header">
      <div><p className="eyebrow">AI INSIGHTS</p><h1>Clinical intelligence, planned carefully</h1><p className="subtle">A future assistive layer will build on the system's existing clinical signals.</p></div>
    </div>
    <div className="v-ai-banner"><p className="eyebrow">PLANNED FEATURE</p><h2>Planned feature - not yet implemented</h2><p>AI will be assistive, will not diagnose, and will not replace threshold alerts.</p></div>
    <div className="v-info-grid">
      <article className="panel v-info-card"><p className="eyebrow">01</p><h3>What it will analyze</h3><p className="subtle">Stored vital readings and deterministic alert history.</p></article>
      <article className="panel v-info-card"><p className="eyebrow">02</p><h3>What it will output</h3><p className="subtle">Assistive context for clinical review, when implemented.</p></article>
      <article className="panel v-info-card"><p className="eyebrow">03</p><h3>Safety boundary</h3><p className="subtle">Assistive only. It does not diagnose and does not replace threshold alerts.</p></article>
    </div>
  </div>;
}

/**
 * routeScoringEngine.js
 * Produces a route confidence score (0–100) based on data quality,
 * vehicle suitability, and available restriction data.
 * Advisory only — never guarantees legal compliance.
 */

export function scoreRoute({ vehicle, routeResult, complianceResult, settings }) {
  let score = 100;
  const notes = [];

  if (!routeResult?.route) {
    return { score: 0, notes: ['No route calculated.'] };
  }

  if (routeResult.demoMode) {
    score -= 30;
    notes.push('Demo/fallback route — live routing not active.');
  }

  if (!vehicle || !vehicle.type) {
    score -= 20;
    notes.push('Vehicle profile incomplete.');
  }

  if (complianceResult) {
    const compScore = complianceResult.score ?? 50;
    // Blend: 60% route quality, 40% compliance
    score = Math.round(score * 0.6 + compScore * 0.4);
    if (complianceResult.status === 'high_risk') notes.push('Compliance AI flagged high risk.');
    if (complianceResult.status === 'missing_data') notes.push('Critical vehicle data missing.');
  }

  if (!settings?.graphHopperApiKey) {
    score -= 10;
    notes.push('Live routing API key not configured.');
  }

  return { score: Math.max(0, Math.min(100, score)), notes };
}

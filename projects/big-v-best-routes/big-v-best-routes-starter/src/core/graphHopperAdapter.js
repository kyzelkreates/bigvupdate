/**
 * graphHopperAdapter.js — routing adapter shim
 * Big V's Best Routes
 *
 * This file preserves import compatibility with existing code.
 * The canonical routing implementation has moved to:
 *   src/services/graphhopperClient.js
 *
 * All imports of calculateGraphHopperRoute, mapVehicleToGraphHopperProfile
 * continue to work without changes in App.jsx or any other consumer.
 */

export {
  calculateRoute as calculateGraphHopperRoute,
  mapVehicleToGHProfile as mapVehicleToGraphHopperProfile,
} from '../services/graphhopperClient.js';

/**
 * ============================================================================
 * GROUND ROUTES
 * ============================================================================
 * 
 * API endpoints for checking ground, slot, and date availability.
 * 
 * Endpoints:
 * - GET /api/grounds/get-available-dates - Get available dates for next 45 days
 * - GET /api/grounds/get-available-slots - Get 24-hour slots for a specific date
 * - GET /api/grounds/get-available-grounds - Get grounds for a specific slot
 * 
 * ============================================================================
 */

import express from 'express';
import { 
  getAvailableDates, 
  getAvailableSlots, 
  getAvailableGrounds,
  updateGroundPricing
} from '../controllers/groundController.js';
// ============================================================================
// ADMIN: UPDATE GROUND PRICING
// ============================================================================
/**
 * Update pricing for a ground (admin only)
 * @route PUT /api/grounds/:id/pricing
 * @body { pricing: { ... } }
 */
const router = express.Router();

router.put('/grounds/:id/pricing', updateGroundPricing);


// ============================================================================
// AVAILABILITY ENDPOINTS
// ============================================================================

/**
 * Get available dates for booking (next 45 days)
 * 
 * @route GET /api/grounds/get-available-dates
 * @returns {Object} Dates grouped by month with enabled/disabled flags
 * 
 * Response Example:
 * {
 *   "2025-01": [
 *     { "date": "2025-01-15", "enabled": true },
 *     { "date": "2025-01-16", "enabled": false }
 *   ],
 *   "2025-02": [...]
 * }
 */
router.get('/grounds/get-available-dates', getAvailableDates);

/**
 * Get available time slots for a specific date
 * 
 * @route GET /api/grounds/get-available-slots
 * @query {string} date - Date in YYYY-MM-DD format (required)
 * @returns {Array} 24 slots with enabled/disabled flags
 * 
 * Query Example: /api/grounds/get-available-slots?date=2025-01-15
 * 
 * Response Example:
 * [
 *   { "slot": "12:00 AM to 1:00 AM", "enabled": true },
 *   { "slot": "1:00 AM to 2:00 AM", "enabled": false },
 *   ...
 * ]
 */
router.get('/grounds/get-available-slots', getAvailableSlots);

/**
 * Get available grounds for a specific date and time
 * 
 * @route GET /api/grounds/get-available-grounds
 * @query {string} date - Date in YYYY-MM-DD format (required)
 * @query {number} startHour - Start hour 0-23 (required)
 * @returns {Array} Grounds with availability flags
 * 
 * Query Example: /api/grounds/get-available-grounds?date=2025-01-15&startHour=14
 * 
 * Response Example:
 * [
 *   { "id": 1, "name": "G1", "location": "Area A", "available": true },
 *   { "id": 2, "name": "G2", "location": "Area B", "available": false },
 *   { "id": 3, "name": "Mega_Ground", "location": "Combined", "available": false }
 * ]
 */
router.get('/grounds/get-available-grounds', getAvailableGrounds);

export default router;

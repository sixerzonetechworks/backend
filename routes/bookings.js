/**
 * ============================================================================
 * BOOKING ROUTES (Legacy - Not Currently Used)
 * ============================================================================
 * 
 * This router was used before Razorpay integration.
 * It creates bookings with 'paid' status directly without payment processing.
 * 
 * Current Flow:
 * - Use payment routes (/api/payments/*) instead
 * - This file kept for reference/fallback purposes
 * 
 * ============================================================================
 */

import express from 'express';
import { bookSlot } from '../controllers/bookingController.js';

const router = express.Router();

// ============================================================================
// BOOKING ENDPOINTS (LEGACY)
// ============================================================================

/**
 * Create a booking without payment processing
 * 
 * @route POST /api/bookings/book-slot
 * @body {string} name - Customer name
 * @body {string} phone - Customer phone
 * @body {string} email - Customer email
 * @body {number} groundId - Ground ID
 * @body {string} date - Date in YYYY-MM-DD format
 * @body {number} startHour - Start hour (0-23)
 * @returns {Object} Booking details with 'paid' status
 * 
 * @deprecated Use POST /api/payments/create-order instead
 * 
 * Request Example:
 * {
 *   "name": "John Doe",
 *   "phone": "1234567890",
 *   "email": "john@example.com",
 *   "groundId": 1,
 *   "date": "2025-01-15",
 *   "startHour": 14
 * }
 * 
 * Response Example:
 * {
 *   "success": true,
 *   "message": "Booking created successfully",
 *   "booking": {
 *     "id": 123,
 *     "name": "John Doe",
 *     "groundName": "G1",
 *     "startTime": "2025-01-15T14:00:00.000Z",
 *     "totalAmount": 1000,
 *     "paymentStatus": "paid"
 *   }
 * }
 */
router.post('/bookings/book-slot', bookSlot);

export default router;

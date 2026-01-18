/**
 * ============================================================================
 * PAYMENT ROUTES
 * ============================================================================
 * 
 * API endpoints for Razorpay payment integration.
 * 
 * Payment Flow:
 * 1. POST /payments/create-order - Create booking + Razorpay order
 * 2. Frontend opens Razorpay modal
 * 3. User completes payment
 * 4. POST /payments/verify - Verify payment signature
 * 5. Booking marked as 'paid'
 * 
 * Error Handling:
 * - POST /payments/failure - Record payment failures
 * - DELETE /payments/cancel/:bookingId - Cancel unpaid bookings
 * 
 * ============================================================================
 */

import express from 'express';
import { 
  createOrder, 
  verifyPayment, 
  handlePaymentFailure, 
  cancelBooking 
} from '../controllers/paymentController.js';

const router = express.Router();

// ============================================================================
// PAYMENT ENDPOINTS
// ============================================================================

/**
 * Create a Razorpay order for a new booking
 * 
 * @route POST /api/payments/create-order
 * @body {string} name - Customer name (required)
 * @body {string} phone - Customer phone 10-15 digits (required)
 * @body {string} email - Customer email (required)
 * @body {number} groundId - Ground ID (required)
 * @body {string} date - Date in YYYY-MM-DD format (required)
 * @body {number} startHour - Start hour 0-23 (required)
 * @returns {Object} Booking and Razorpay order details
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
 *   "booking": {
 *     "id": 123,
 *     "name": "John Doe",
 *     "groundName": "G1",
 *     "totalAmount": 1000,
 *     "paymentStatus": "processing"
 *   },
 *   "order": {
 *     "id": "order_xyz123",
 *     "amount": 100000,
 *     "currency": "INR"
 *   },
 *   "razorpayKeyId": "rzp_test_..."
 * }
 */
router.post('/payments/create-order', createOrder);

/**
 * Verify payment signature after successful payment
 * 
 * @route POST /api/payments/verify
 * @body {string} razorpay_order_id - Razorpay order ID (required)
 * @body {string} razorpay_payment_id - Razorpay payment ID (required)
 * @body {string} razorpay_signature - Payment signature (required)
 * @body {number} bookingId - Booking ID (required)
 * @returns {Object} Verification result
 * 
 * Request Example:
 * {
 *   "razorpay_order_id": "order_xyz123",
 *   "razorpay_payment_id": "pay_abc456",
 *   "razorpay_signature": "signature_hash",
 *   "bookingId": 123
 * }
 * 
 * Response Example:
 * {
 *   "success": true,
 *   "message": "Payment verified successfully",
 *   "booking": {
 *     "id": 123,
 *     "name": "John Doe",
 *     "groundName": "G1",
 *     "paymentStatus": "paid",
 *     "paymentMethod": "upi",
 *     "paymentCompletedAt": "2025-01-15T14:30:00.000Z"
 *   }
 * }
 */
router.post('/payments/verify', verifyPayment);

/**
 * Handle payment failure
 * 
 * @route POST /api/payments/failure
 * @body {number} bookingId - Booking ID (required)
 * @body {Object} error - Error details from Razorpay (optional)
 * @returns {Object} Failure acknowledgment
 * 
 * Request Example:
 * {
 *   "bookingId": 123,
 *   "error": {
 *     "code": "BAD_REQUEST_ERROR",
 *     "description": "Payment failed",
 *     "reason": "payment_failed"
 *   }
 * }
 * 
 * Response Example:
 * {
 *   "success": true,
 *   "message": "Payment failure recorded"
 * }
 */
router.post('/payments/failure', handlePaymentFailure);

/**
 * Cancel a pending or failed booking
 * 
 * @route DELETE /api/payments/cancel/:bookingId
 * @param {number} bookingId - Booking ID to cancel
 * @returns {Object} Cancellation confirmation
 * 
 * Usage Example: DELETE /api/payments/cancel/123
 * 
 * Response Example:
 * {
 *   "success": true,
 *   "message": "Booking cancelled successfully"
 * }
 * 
 * Error Response (if booking is paid):
 * {
 *   "error": "Cannot cancel paid booking. Please request refund."
 * }
 */
router.delete('/payments/cancel/:bookingId', cancelBooking);

export default router;

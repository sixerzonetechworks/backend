/**
 * Admin Routes
 * Routes for admin authentication and management
 */

import express from 'express';
import adminController from '../controllers/adminController.js';
import offlineBookingController from '../controllers/offlineBookingController.js';
import { verifyAdmin } from '../middleware/adminAuth.js';

const router = express.Router();

// Public routes
router.post('/login', adminController.login);

// Protected routes (require admin authentication)
router.get('/bookings', verifyAdmin, adminController.getAllBookings);
router.get('/bookings/search', verifyAdmin, adminController.searchBooking);
router.get('/statistics', verifyAdmin, adminController.getStatistics);

// Offline booking routes
router.post('/offline-booking', verifyAdmin, offlineBookingController.createOfflineBooking);

// Blocked slots routes
router.post('/blocked-slots', verifyAdmin, adminController.blockTimeSlot);
router.delete('/blocked-slots/:id', verifyAdmin, adminController.unblockTimeSlot);
router.get('/blocked-slots', verifyAdmin, adminController.getBlockedSlots);

export default router;

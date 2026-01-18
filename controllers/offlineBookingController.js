/**
 * Offline Booking Controller
 * Handles walk-in/offline bookings by admin (no payment processing)
 * Uses the same APIs and flow as online bookings
 */

import db from '../models/index.js';
import { Op } from 'sequelize';

const { Ground, Booking } = db;

/**
 * Create offline booking (admin only)
 * Same validation and flow as online bookings, but status is set to 'paid' directly
 * and bookingType is marked as 'offline'
 */
export const createOfflineBooking = async (req, res) => {
  try {
    const { name, phone, email, groundId, date, startHour, duration = 1, totalAmount } = req.body;

    // Validation
    if (!name || !phone || !email || !groundId || !date || startHour === undefined) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required'
      });
    }

    // Verify ground exists
    const ground = await Ground.findByPk(groundId);
    if (!ground) {
      return res.status(404).json({
        success: false,
        message: 'Ground not found'
      });
    }

    // Calculate start and end times
    const bookingDate = new Date(date);
    bookingDate.setHours(startHour, 0, 0, 0);
    const startTime = bookingDate;
    
    const endDate = new Date(bookingDate);
    endDate.setHours(startHour + duration, 0, 0, 0);
    const endTime = endDate;

    // Check for existing paid bookings (same logic as online bookings)
    const existingBooking = await Booking.findOne({
      where: {
        startTime: {
          [Op.lt]: endTime
        },
        endTime: {
          [Op.gt]: startTime
        },
        paymentStatus: 'paid',
        groundId: {
          [Op.in]: getRelatedGrounds(groundId)
        }
      }
    });

    if (existingBooking) {
      return res.status(400).json({
        success: false,
        message: 'This slot is already booked'
      });
    }

    // Create offline booking with 'paid' status and 'offline' bookingType
    const booking = await Booking.create({
      name,
      phone,
      email,
      groundId,
      startTime,
      endTime,
      duration,
      totalAmount: totalAmount || 0,
      paymentStatus: 'paid',
      bookingType: 'offline', // Mark as offline booking
      paymentMethod: 'cash',
      paymentCompletedAt: new Date()
    });

    // Fetch ground details for response
    const groundDetails = await Ground.findByPk(groundId);

    res.json({
      success: true,
      message: 'Offline booking created successfully',
      booking: {
        id: booking.id,
        name: booking.name,
        phone: booking.phone,
        email: booking.email,
        groundId: booking.groundId,
        groundName: groundDetails.name,
        startTime: booking.startTime,
        endTime: booking.endTime,
        duration: booking.duration,
        totalAmount: booking.totalAmount,
        paymentStatus: booking.paymentStatus,
        bookingType: booking.bookingType
      }
    });

  } catch (error) {
    console.error('Offline booking error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create offline booking',
      error: error.message
    });
  }
};

/**
 * Get related grounds for conflict checking
 * Mega_Ground (id=3) conflicts with G1 (id=1) and G2 (id=2)
 */
function getRelatedGrounds(groundId) {
  const relatedMap = {
    1: [1, 3], // G1 is related to G1 and Mega_Ground
    2: [2, 3], // G2 is related to G2 and Mega_Ground
    3: [1, 2, 3] // Mega_Ground is related to all
  };
  return relatedMap[parseInt(groundId)] || [parseInt(groundId)];
}

export default {
  createOfflineBooking
};

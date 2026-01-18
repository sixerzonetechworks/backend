/**
 * ============================================================================
 * BOOKING CONTROLLER (Legacy - Not Currently Used)
 * ============================================================================
 * 
 * This controller was used before Razorpay integration.
 * It created bookings with 'paid' status directly without payment processing.
 * 
 * Current Flow:
 * - Use paymentController.createOrder() instead
 * - This file kept for reference/fallback purposes
 * 
 * To Use This Controller:
 * 1. Remove Razorpay integration
 * 2. Update routes to use this controller
 * 3. Remove payment verification logic
 * 
 * ============================================================================
 */

import db from '../models/index.js';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get related grounds for conflict detection
 * 
 * Rules:
 * - Mega_Ground blocks both G1 and G2
 * - G1 or G2 blocks Mega_Ground
 * 
 * @param {string} groundName - Name of the ground (G1, G2, or Mega_Ground)
 * @returns {string[]} Array of related ground names
 */
function getRelatedGrounds(groundName) {
  if (groundName === 'Mega_Ground') return ['G1', 'G2'];
  if (groundName === 'G1' || groundName === 'G2') return ['Mega_Ground'];
  return [];
}

// ============================================================================
// CONTROLLER FUNCTIONS
// ============================================================================

/**
 * Book a slot directly without payment processing (LEGACY)
 * 
 * This function creates a booking with 'paid' status immediately.
 * No payment gateway integration - for testing or internal bookings.
 * 
 * @route POST /api/bookings/book
 * @body {string} name - Customer name
 * @body {string} phone - Customer phone
 * @body {string} email - Customer email
 * @body {number} groundId - Ground ID
 * @body {string} date - Date in YYYY-MM-DD format
 * @body {number} startHour - Start hour (0-23)
 * @returns {Object} Booking details
 * 
 * @deprecated Use paymentController.createOrder() instead
 */
export const bookSlot = async (req, res) => {
  try {
    const { name, phone, email, groundId, date, startHour } = req.body;

    // ========================================================================
    // INPUT VALIDATION
    // ========================================================================
    
    if (!name || !phone || !email || !groundId || !date || startHour === undefined) {
      return res.status(400).json({ 
        error: 'All fields are required: name, phone, email, groundId, date, startHour' 
      });
    }

    const startHourNum = parseInt(startHour);
    if (isNaN(startHourNum) || startHourNum < 0 || startHourNum > 23) {
      return res.status(400).json({ error: 'startHour must be between 0 and 23' });
    }

    // ========================================================================
    // GROUND VALIDATION
    // ========================================================================
    
    const ground = await db.Ground.findByPk(groundId);
    if (!ground) {
      return res.status(404).json({ error: 'Ground not found' });
    }

    // ========================================================================
    // DATE & TIME VALIDATION
    // ========================================================================
    
    const dateObj = new Date(date + 'T00:00:00');
    if (isNaN(dateObj.getTime())) {
      return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD' });
    }

    const startTime = new Date(dateObj);
    startTime.setHours(startHourNum, 0, 0, 0);

    const endTime = new Date(startTime);
    endTime.setHours(startTime.getHours() + 1);

    // Check if booking is in the past (30-minute buffer)
    const now = new Date();
    const slotEndBuffer = new Date(startTime);
    slotEndBuffer.setMinutes(slotEndBuffer.getMinutes() + 30);
    
    if (now >= slotEndBuffer) {
      return res.status(400).json({ 
        error: 'Cannot book slots that have less than 30 minutes remaining' 
      });
    }

    // ========================================================================
    // CONFLICT DETECTION
    // ========================================================================
    
    const relatedGrounds = getRelatedGrounds(ground.name);
    const allRelevantGroundNames = [ground.name, ...relatedGrounds];

    // Get ground IDs for relevant grounds
    const relevantGrounds = await db.Ground.findAll({
      where: {
        name: {
          [db.Sequelize.Op.in]: allRelevantGroundNames
        }
      }
    });
    const relevantGroundIds = relevantGrounds.map(g => g.id);

    // Check for overlapping paid bookings
    const overlappingBookings = await db.Booking.findAll({
      where: {
        groundId: {
          [db.Sequelize.Op.in]: relevantGroundIds
        },
        startTime: {
          [db.Sequelize.Op.gte]: dateObj,
          [db.Sequelize.Op.lt]: new Date(dateObj.getTime() + 24 * 60 * 60 * 1000)
        },
        paymentStatus: 'paid'
      }
    });

    // Check if the exact hour is already booked
    const isSlotBooked = overlappingBookings.some(booking => {
      const bookingStartHour = booking.startTime.getHours();
      
      // Check single-hour booking
      if (booking.duration === 1 && bookingStartHour === startHourNum) {
        return true;
      }
      
      // Check multi-hour bookings (legacy data)
      for (let i = 0; i < booking.duration; i++) {
        if ((bookingStartHour + i) % 24 === startHourNum) {
          return true;
        }
      }
      return false;
    });

    if (isSlotBooked) {
      return res.status(400).json({ 
        error: 'This slot is already booked or conflicts with related grounds' 
      });
    }

    // ========================================================================
    // PRICING CALCULATION
    // ========================================================================
    
    const duration = 1; // Always 1 hour
    const dayOfWeek = startTime.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    
    // First half: 6 AM to 6 PM (hours 6-17)
    // Second half: 6 PM to 6 AM (hours 18-23 and 0-5)
    const isFirstHalf = startHourNum >= 6 && startHourNum < 18;
    
    let pricingKey;
    if (isWeekend) {
      pricingKey = isFirstHalf ? 'Weekend_first_half' : 'Weekend_second_half';
    } else {
      pricingKey = isFirstHalf ? 'Weekday_first_half' : 'Weekday_second_half';
    }
    
    // Prices in DB are per hour
    const totalAmount = ground.pricing[pricingKey] || 1000;

    // ========================================================================
    // CREATE BOOKING (PAID STATUS - NO PAYMENT GATEWAY)
    // ========================================================================
    
    const booking = await db.Booking.create({
      name,
      phone,
      email,
      groundId,
      startTime,
      endTime,
      duration,
      totalAmount,
      paymentStatus: 'paid' // Mark as paid directly (no payment processing)
    });

    // ========================================================================
    // RETURN RESPONSE
    // ========================================================================
    
    res.status(201).json({
      success: true,
      message: 'Booking created successfully',
      booking: {
        id: booking.id,
        name: booking.name,
        phone: booking.phone,
        email: booking.email,
        groundId: booking.groundId,
        groundName: ground.name,
        date: date,
        startHour: startHourNum,
        startTime: booking.startTime,
        endTime: booking.endTime,
        duration: booking.duration,
        totalAmount: booking.totalAmount,
        paymentStatus: booking.paymentStatus,
        createdAt: booking.createdAt
      }
    });
  } catch (error) {
    console.error('Error creating booking:', error);
    res.status(500).json({ 
      error: 'Internal server error', 
      details: process.env.NODE_ENV === 'development' ? error.message : undefined 
    });
  }
};

// ============================================================================
// UPDATE GROUND PRICING (ADMIN)
// ============================================================================

/**
 * Update pricing for a ground (admin only)
 * @route PUT /api/grounds/:id/pricing
 * @param {number} req.params.id - Ground ID
 * @param {Object} req.body.pricing - Pricing JSON object
 * @returns {Object} Updated ground
 */
export const updateGroundPricing = async (req, res) => {
  try {
    const groundId = req.params.id;
    const { pricing } = req.body;
    if (!pricing || typeof pricing !== 'object') {
      return res.status(400).json({ error: 'Valid pricing object required' });
    }
    const ground = await Ground.findByPk(groundId);
    if (!ground) {
      return res.status(404).json({ error: 'Ground not found' });
    }
    ground.pricing = pricing;
    await ground.save();
    res.json({ success: true, ground });
  } catch (error) {
    console.error('Error updating ground pricing:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
/**
 * ============================================================================
 * GROUND CONTROLLER
 * ============================================================================
 * 
 * Handles availability checking for grounds, slots, and dates.
 * 
 * Key Features:
 * - Dynamic availability calculation for next 45 days
 * - Related ground conflict detection (Mega_Ground ↔ G1/G2)
 * - Only considers 'paid' bookings for availability
 * - Real-time slot availability based on current time
 * - 30-minute buffer for ongoing slots
 * 
 * ============================================================================
 */

import db from '../models/index.js';

const { Ground, Booking, BlockedSlot } = db;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get formatted slot label for display
 * 
 * Converts 24-hour format to 12-hour format with AM/PM
 * Example: Hour 14 → "2:00 PM to 3:00 PM"
 * 
 * @param {number} hour - Hour in 24-hour format (0-23)
 * @returns {string} Formatted slot label
 */
function getSlotLabel(hour) {
  const startHour = hour % 12 === 0 ? 12 : hour % 12;
  const endHour = (hour + 1) % 12 === 0 ? 12 : (hour + 1) % 12;
  const startAmPm = hour < 12 ? 'AM' : 'PM';
  const endAmPm = (hour + 1) < 12 || (hour + 1) === 24 ? 'AM' : 'PM';
  
  return `${startHour}:00 ${startAmPm} to ${endHour}:00 ${endAmPm}`;
}

/**
 * Get related grounds for conflict detection
 * 
 * Ground Relationships:
 * - Mega_Ground = G1 + G2 (booking Mega_Ground blocks both)
 * - G1 or G2 booked → Mega_Ground unavailable
 * - G1 and G2 independent of each other
 * 
 * @param {string} groundName - Name of the ground (G1, G2, or Mega_Ground)
 * @returns {string[]} Array of related ground names
 */
function getRelatedGrounds(groundName) {
  if (groundName === 'Mega_Ground') return ['G1', 'G2'];
  if (groundName === 'G1' || groundName === 'G2') return ['Mega_Ground'];
  return [];
}

/**
 * Check if a time range overlaps with a booking
 * 
 * Overlap Logic:
 * - Booking starts before requested end time
 * - Booking ends after requested start time
 * 
 * @param {Object} booking - Booking object with startTime and duration
 * @param {Date} requestedStart - Requested start time
 * @param {Date} requestedEnd - Requested end time
 * @returns {boolean} True if overlap exists
 */
function checkTimeOverlap(booking, requestedStart, requestedEnd) {
  const bookingStart = booking.startTime;
  const bookingEnd = new Date(bookingStart);
  bookingEnd.setHours(bookingStart.getHours() + booking.duration);

  return bookingStart < requestedEnd && bookingEnd > requestedStart;
}

/**
 * Check if a time slot is blocked by admin
 * 
 * @param {Array} blockedSlots - Array of blocked slot records
 * @param {string} timeSlot - Time slot string (e.g., "9:00 AM - 10:00 AM")
 * @param {number} groundId - Ground ID to check (null checks all grounds)
 * @returns {boolean} True if slot is blocked
 */
function isSlotBlocked(blockedSlots, timeSlot, groundId) {
  return blockedSlots.some(block => {
    // Block applies if it's for this specific ground or all grounds (null)
    const appliesToGround = block.groundId === null || block.groundId === groundId;
    const matchesTimeSlot = block.timeSlot === timeSlot;
    return appliesToGround && matchesTimeSlot && block.isActive;
  });
}

/**
 * Calculate pricing for a ground based on date and time
 * 
 * Pricing Rules:
 * - Weekday: Monday to Friday
 * - Weekend: Saturday to Sunday
 * - First Half: 6:00 AM (6) to 6:00 PM (18) - hours 6-17
 * - Second Half: 6:00 PM (18) to 6:00 AM (6) - hours 18-23 and 0-5
 * 
 * @param {Object} ground - Ground object with pricing JSON
 * @param {Date} date - Date of booking
 * @param {number} hour - Hour of booking (0-23)
 * @returns {number} Price for the slot
 */
function calculatePrice(ground, date, hour) {
  const pricing = ground.pricing;
  
  // Determine if weekday or weekend
  const dayOfWeek = date.getDay(); // 0 = Sunday, 6 = Saturday
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  
  // Determine if first half or second half
  // First half: 6 AM to 6 PM (hours 6-17)
  // Second half: 6 PM to 6 AM (hours 18-23 and 0-5)
  const isFirstHalf = hour >= 6 && hour < 18;
  
  // Select appropriate pricing key
  let pricingKey;
  if (isWeekend) {
    pricingKey = isFirstHalf ? 'Weekend_first_half' : 'Weekend_second_half';
  } else {
    pricingKey = isFirstHalf ? 'Weekday_first_half' : 'Weekday_second_half';
  }
  
  return pricing[pricingKey] || 1000; // Default to 1000 if key not found
}

// ============================================================================
// CONTROLLER FUNCTIONS
// ============================================================================

/**
 * Get available dates for booking (next 45 days)
 * 
 * Returns dates grouped by month with enabled/disabled flag.
 * A date is enabled if at least one slot has at least one ground available.
 * 
 * Algorithm:
 * 1. Generate dates for next 45 days
 * 2. For each date, check all 24 hours
 * 3. For each hour, check if any ground is available
 * 4. If at least one hour has available ground → date enabled
 * 5. Group by month (YYYY-MM) for UI display
 * 
 * Special Cases:
 * - Today: Only future slots (with 30-minute buffer)
 * - Past slots: Always disabled
 * - Related grounds: Check G1/G2 conflicts with Mega_Ground
 * 
 * @route GET /api/grounds/available-dates
 * @returns {Object} Dates grouped by month with availability
 * 
 * Response Format:
 * {
 *   "2025-01": [
 *     { "date": "2025-01-15", "enabled": true },
 *     { "date": "2025-01-16", "enabled": false }
 *   ],
 *   "2025-02": [...]
 * }
 */
export const getAvailableDates = async (req, res) => {
  try {
    // ========================================================================
    // DATE RANGE SETUP
    // ========================================================================
    
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endDate = new Date(today);
    endDate.setDate(today.getDate() + 45); // Next 45 days

    // ========================================================================
    // FETCH GROUNDS AND BOOKINGS
    // ========================================================================
    
    // Fetch all grounds
    const grounds = await db.Ground.findAll();

    // Fetch all paid bookings for the next 45 days
    const bookings = await db.Booking.findAll({
      where: {
        startTime: {
          [db.Sequelize.Op.gte]: today,
          [db.Sequelize.Op.lt]: endDate
        },
        paymentStatus: 'paid' // Only consider paid bookings
      },
      include: [{ model: db.Ground, as: 'ground' }]
    });

    // Fetch all blocked slots for the next 45 days
    const blockedSlots = await BlockedSlot.findAll({
      where: {
        date: {
          [db.Sequelize.Op.between]: [
            today.toISOString().split('T')[0],
            endDate.toISOString().split('T')[0]
          ]
        },
        isActive: true
      }
    });

    // ========================================================================
    // GROUP BOOKINGS AND BLOCKS BY DATE
    // ========================================================================
    
    const bookingsByDate = {};
    const blocksByDate = {};
    
    bookings.forEach(b => {
      const dateKey = b.startTime.toISOString().split('T')[0];
      if (!bookingsByDate[dateKey]) bookingsByDate[dateKey] = [];
      bookingsByDate[dateKey].push(b);
    });

    blockedSlots.forEach(b => {
      if (!blocksByDate[b.date]) blocksByDate[b.date] = [];
      blocksByDate[b.date].push(b);
    });

    // ========================================================================
    // PROCESS EACH DATE
    // ========================================================================
    
    const result = {};
    const currentDate = new Date(today);

    while (currentDate < endDate) {
      const dateStr = currentDate.toLocaleDateString('en-CA');
      const monthKey = dateStr.substring(0, 7); // YYYY-MM for grouping

      if (!result[monthKey]) result[monthKey] = [];

      const dayBookings = bookingsByDate[dateStr] || [];
      const dayBlocks = blocksByDate[dateStr] || [];
      const isToday = currentDate.toDateString() === now.toDateString();
      
      // ======================================================================
      // DETERMINE CHECKABLE HOURS
      // ======================================================================
      
      let requiredHours;
      if (isToday) {
        // For today, only check future hours with 30-minute buffer
        const currentHour = now.getHours();
        requiredHours = Array.from({ length: 24 - currentHour }, (_, i) => currentHour + i)
          .filter(h => {
            const requestedStartTime = new Date(currentDate);
            requestedStartTime.setHours(h, 0, 0, 0);
            const slotEndBuffer = new Date(requestedStartTime);
            slotEndBuffer.setMinutes(slotEndBuffer.getMinutes() + 30);
            return now < slotEndBuffer;
          });
      } else {
        // For future dates, check all 24 hours
        requiredHours = Array.from({ length: 24 }, (_, i) => i);
      }

      // ======================================================================
      // CHECK IF DATE HAS ANY AVAILABLE SLOT
      // ======================================================================
      
      let enabled = false;
      
      for (const hour of requiredHours) {
        const requestedStartTime = new Date(currentDate);
        requestedStartTime.setHours(hour, 0, 0, 0);
        const requestedEndTime = new Date(requestedStartTime);
        requestedEndTime.setHours(hour + 1);

        // Check if any ground is available for this hour
        let anyGroundAvailable = false;
        const slotLabel = getSlotLabel(hour);
        
        for (const ground of grounds) {
          const relatedGrounds = getRelatedGrounds(ground.name);
          const allRelevantGrounds = [ground.name, ...relatedGrounds];
          
          // Filter bookings for this ground and related grounds
          const relevantBookings = dayBookings.filter(b => 
            allRelevantGrounds.includes(b.ground.name)
          );
          
          // Check if slot is blocked for this ground
          if (isSlotBlocked(dayBlocks, slotLabel, ground.id)) {
            continue; // Skip this ground, it's blocked
          }
          
          // Check if ground is available (no overlapping bookings)
          let isAvailable = true;
          for (const booking of relevantBookings) {
            if (checkTimeOverlap(booking, requestedStartTime, requestedEndTime)) {
              isAvailable = false;
              break;
            }
          }
          
          if (isAvailable) {
            anyGroundAvailable = true;
            break;
          }
        }
        
        if (anyGroundAvailable) {
          enabled = true;
          break; // At least one slot is available, date is enabled
        }
      }

      result[monthKey].push({ date: dateStr, enabled });

      currentDate.setDate(currentDate.getDate() + 1);
    }

    res.json(result);
  } catch (error) {
    console.error('Error fetching available dates:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get available time slots for a specific date
 * 
 * Returns all 24 hours with enabled/disabled flag.
 * A slot is enabled if at least one ground is available.
 * 
 * Algorithm:
 * 1. Fetch all grounds and bookings for the date
 * 2. For each hour (0-23):
 *    a. Check if time has passed (30-minute buffer)
 *    b. For each ground, check related grounds
 *    c. Check if any booking overlaps
 *    d. If at least one ground available → enabled
 * 
 * @route GET /api/grounds/available-slots?date=YYYY-MM-DD
 * @query {string} date - Date in YYYY-MM-DD format
 * @returns {Array} Array of 24 slots with availability
 * 
 * Response Format:
 * [
 *   { "slot": "12:00 AM to 1:00 AM", "enabled": true },
 *   { "slot": "1:00 AM to 2:00 AM", "enabled": false },
 *   ...
 * ]
 */
export const getAvailableSlots = async (req, res) => {
  try {
    const { date } = req.query;
    
    // ========================================================================
    // INPUT VALIDATION
    // ========================================================================
    
    if (!date) {
      return res.status(400).json({ error: 'date is required query parameter' });
    }

    const dateObj = new Date(date + 'T00:00:00');
    if (isNaN(dateObj.getTime())) {
      return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD' });
    }

    const nextDay = new Date(dateObj);
    nextDay.setDate(nextDay.getDate() + 1);

    // ========================================================================
    // FETCH GROUNDS AND BOOKINGS
    // ========================================================================
    
    const grounds = await db.Ground.findAll();

    // Fetch all paid bookings for the date
    const bookings = await db.Booking.findAll({
      where: {
        startTime: {
          [db.Sequelize.Op.gte]: dateObj,
          [db.Sequelize.Op.lt]: nextDay
        },
        paymentStatus: 'paid'
      },
      include: [{ model: db.Ground, as: 'ground' }]
    });

    // ========================================================================
    // TIME CHECKING SETUP
    // ========================================================================
    
    const now = new Date();
    const isToday = dateObj.toDateString() === now.toDateString();

    // ========================================================================
    // PROCESS EACH HOUR
    // ========================================================================
    
    const result = [];
    
    for (let hour = 0; hour < 24; hour++) {
      const requestedStartTime = new Date(dateObj);
      requestedStartTime.setHours(hour, 0, 0, 0);
      const slotEndBuffer = new Date(requestedStartTime);
      slotEndBuffer.setMinutes(slotEndBuffer.getMinutes() + 30);

      // Check if slot has passed
      let enabled = true;
      if (now >= slotEndBuffer) {
        enabled = false;
      } else {
        const requestedEndTime = new Date(requestedStartTime);
        requestedEndTime.setHours(hour + 1);

        // Check if at least one ground is available
        let anyGroundAvailable = false;
        
        for (const ground of grounds) {
          const relatedGrounds = getRelatedGrounds(ground.name);
          const allRelevantGrounds = [ground.name, ...relatedGrounds];
          
          const relevantBookings = bookings.filter(b => 
            allRelevantGrounds.includes(b.ground.name)
          );
          
          let isAvailable = true;
          for (const booking of relevantBookings) {
            if (checkTimeOverlap(booking, requestedStartTime, requestedEndTime)) {
              isAvailable = false;
              break;
            }
          }
          
          if (isAvailable) {
            anyGroundAvailable = true;
            break;
          }
        }
        
        enabled = anyGroundAvailable;
      }
      
      result.push({ slot: getSlotLabel(hour), enabled });
    }

    res.json(result);
  } catch (error) {
    console.error('Error fetching available slots:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get available grounds for a specific date and time slot
 * 
 * Returns all grounds with availability flag for the requested slot.
 * 
 * Algorithm:
 * 1. Validate input parameters
 * 2. Fetch all grounds
 * 3. Fetch bookings for the entire date
 * 4. For each ground:
 *    a. Get related grounds (Mega_Ground ↔ G1/G2)
 *    b. Check if any related booking overlaps
 *    c. Mark as available or unavailable
 * 
 * @route GET /api/grounds/available-grounds?date=YYYY-MM-DD&startHour=0-23
 * @query {string} date - Date in YYYY-MM-DD format
 * @query {number} startHour - Start hour (0-23)
 * @returns {Array} Array of grounds with availability
 * 
 * Response Format:
 * [
 *   { "id": 1, "name": "G1", "location": "Area A", "available": true },
 *   { "id": 2, "name": "G2", "location": "Area B", "available": false },
 *   { "id": 3, "name": "Mega_Ground", "location": "Combined", "available": false }
 * ]
 */
export const getAvailableGrounds = async (req, res) => {
  try {
    const { date, startHour } = req.query;

    // ========================================================================
    // INPUT VALIDATION
    // ========================================================================
    
    if (!date) {
      return res.status(400).json({ error: 'date is required query parameter' });
    }
    if (!startHour) {
      return res.status(400).json({ error: 'startHour is required query parameter' });
    }

    const startHourNum = parseInt(startHour);

    if (isNaN(startHourNum) || startHourNum < 0 || startHourNum > 23) {
      return res.status(400).json({ error: 'startHour must be between 0 and 23' });
    }

    const dateObj = new Date(date + 'T00:00:00');
    if (isNaN(dateObj.getTime())) {
      return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD' });
    }

    // ========================================================================
    // TIME RANGE SETUP
    // ========================================================================
    
    const requestedStartTime = new Date(dateObj);
    requestedStartTime.setHours(startHourNum, 0, 0, 0);

    // All bookings are 1 hour
    const requestedEndTime = new Date(requestedStartTime);
    requestedEndTime.setHours(requestedStartTime.getHours() + 1);

    // ========================================================================
    // FETCH GROUNDS AND BOOKINGS
    // ========================================================================
    
    const grounds = await db.Ground.findAll();

    // Fetch all paid bookings for the date
    const bookings = await db.Booking.findAll({
      where: {
        startTime: {
          [db.Sequelize.Op.gte]: dateObj,
          [db.Sequelize.Op.lt]: new Date(dateObj.getTime() + 24 * 60 * 60 * 1000)
        },
        paymentStatus: 'paid'
      },
      include: [{ model: db.Ground, as: 'ground' }]
    });

    // ========================================================================
    // CHECK AVAILABILITY FOR EACH GROUND
    // ========================================================================
    
    const availableGrounds = grounds.map(ground => {
      const relatedGrounds = getRelatedGrounds(ground.name);
      const allRelevantGrounds = [ground.name, ...relatedGrounds];
      
      // Filter bookings for this ground and related grounds
      const relevantBookings = bookings.filter(b => 
        allRelevantGrounds.includes(b.ground.name)
      );
      
      // Check if ground is available
      let isAvailable = true;
      for (const booking of relevantBookings) {
        if (checkTimeOverlap(booking, requestedStartTime, requestedEndTime)) {
          isAvailable = false;
          break;
        }
      }

      // Calculate pricing for this specific date and time
      const price = calculatePrice(ground, dateObj, startHourNum);

      return {
        id: ground.id,
        name: ground.name,
        description: ground.description,
        available: isAvailable,
        price: price,
        pricing: ground.pricing // Include full pricing object for admin panel
      };
    });

    res.json(availableGrounds);
  } catch (error) {
    console.error('Error fetching available grounds:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

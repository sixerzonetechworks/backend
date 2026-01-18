/**
 * Admin Controller
 * Handles admin authentication and management
 */

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from '../models/index.js';
import { JWT_SECRET } from '../middleware/adminAuth.js';
import { Op, Sequelize } from 'sequelize';

const { Admin, Booking, Ground, BlockedSlot } = db;

/**
 * Admin Login
 */
export const login = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username and password are required'
      });
    }

    const admin = await Admin.findOne({
      where: { username, isActive: true }
    });

    if (!admin) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    const isPasswordValid = await bcrypt.compare(password, admin.password);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    const token = jwt.sign(
      {
        adminId: admin.id,
        username: admin.username,
        email: admin.email,
        role: admin.role
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        token,
        admin: {
          id: admin.id,
          username: admin.username,
          email: admin.email,
          role: admin.role
        }
      }
    });
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({
      success: false,
      message: 'Login failed',
      error: error.message
    });
  }
};

/**
 * Get All Bookings with filters
 */
export const getAllBookings = async (req, res) => {
  try {
    const { date, phone, email, status, groundId, fromDate, page = 1, limit = 50 } = req.query;

    const where = {};
    
    if (date) {
      const startOfDay = new Date(date + 'T00:00:00.000Z');
      const endOfDay = new Date(date + 'T23:59:59.999Z');
      where.startTime = { 
        [Op.gte]: startOfDay, 
        [Op.lt]: endOfDay 
      };
    }
    
    // Filter for current and future bookings
    if (fromDate) {
      where.startTime = { 
        [Op.gte]: new Date(fromDate) 
      };
    }
    
    if (phone) {
      where.phone = { [Op.like]: `%${phone}%` };
    }
    
    if (email) {
      where.email = { [Op.like]: `%${email}%` };
    }
    
    if (status) {
      where.paymentStatus = status;
    }
    
    if (groundId) {
      where.groundId = groundId;
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);

    const { count, rows: bookings } = await Booking.findAndCountAll({
      where,
      include: [
        {
          model: Ground,
          as: 'ground',
          attributes: ['id', 'name', 'description']
        }
      ],
      order: [['startTime', 'DESC'], ['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset
    });

    res.json({
      success: true,
      data: {
        bookings,
        pagination: {
          total: count,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(count / parseInt(limit))
        }
      }
    });
  } catch (error) {
    console.error('Get bookings error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch bookings',
      error: error.message
    });
  }
};

/**
 * Search Booking by Phone or Email
 */
export const searchBooking = async (req, res) => {
  try {
    const { query } = req.query;

    if (!query) {
      return res.status(400).json({
        success: false,
        message: 'Search query is required'
      });
    }

    // Search in bookings - phone field needs to be cast to text for LIKE operation
    const bookings = await Booking.findAll({
      where: {
        [Op.or]: [
          Sequelize.where(
            Sequelize.cast(Sequelize.col('phone'), 'VARCHAR'),
            { [Op.like]: `%${query}%` }
          ),
          { email: { [Op.like]: `%${query}%` } },
          { name: { [Op.like]: `%${query}%` } }
        ]
      },
      include: [
        {
          model: Ground,
          as: 'ground',
          attributes: ['id', 'name', 'description']
        }
      ],
      order: [['startTime', 'DESC'], ['createdAt', 'DESC']],
      limit: 20
    });

    res.json({
      success: true,
      data: { bookings }
    });
  } catch (error) {
    console.error('Search booking error:', error);
    res.status(500).json({
      success: false,
      message: 'Search failed',
      error: error.message
    });
  }
};

/**
 * Get Booking Statistics
 */
export const getStatistics = async (req, res) => {
  try {
    const { period = 'lifetime' } = req.query;
    
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

    // Calculate period start based on selected period
    let periodStart;
    switch(period) {
      case 'day':
        periodStart = startOfDay;
        break;
      case 'week':
        periodStart = new Date(today);
        periodStart.setDate(today.getDate() - 7);
        break;
      case 'month':
        periodStart = new Date(today);
        periodStart.setMonth(today.getMonth() - 1);
        break;
      case 'year':
        periodStart = new Date(today);
        periodStart.setFullYear(today.getFullYear() - 1);
        break;
      default: // lifetime
        periodStart = null;
    }

    // Build where clause for period
    const periodWhere = periodStart ? {
      startTime: { [Op.gte]: periodStart }
    } : {};

    const [
      totalBookings,
      todayBookings,
      confirmedBookings,
      totalRevenue
    ] = await Promise.all([
      Booking.count({ where: periodWhere }),
      Booking.count({ 
        where: { 
          startTime: { 
            [Op.gte]: startOfDay, 
            [Op.lt]: endOfDay 
          } 
        } 
      }),
      Booking.count({ 
        where: { 
          paymentStatus: 'paid',
          ...periodWhere
        } 
      }),
      Booking.sum('totalAmount', { 
        where: { 
          paymentStatus: 'paid',
          ...periodWhere
        } 
      })
    ]);

    res.json({
      success: true,
      data: {
        totalBookings,
        todayBookings,
        confirmedBookings,
        totalRevenue: totalRevenue || 0
      }
    });
  } catch (error) {
    console.error('Get statistics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch statistics',
      error: error.message
    });
  }
};

/**
 * Block Time Slot
 */
export const blockTimeSlot = async (req, res) => {
  try {
    const { date, timeSlot, groundId, reason } = req.body;

    if (!date || !timeSlot) {
      return res.status(400).json({
        success: false,
        message: 'Date and time slot are required'
      });
    }

    // Check if slot is already blocked
    const existingBlock = await BlockedSlot.findOne({
      where: {
        date,
        timeSlot,
        groundId: groundId || null,
        isActive: true
      }
    });

    if (existingBlock) {
      return res.status(400).json({
        success: false,
        message: 'This slot is already blocked'
      });
    }

    const blockedSlot = await BlockedSlot.create({
      date,
      timeSlot,
      groundId: groundId || null,
      reason: reason || 'Blocked by admin',
      blockedBy: req.admin.id
    });

    res.json({
      success: true,
      message: 'Time slot blocked successfully',
      data: { blockedSlot }
    });
  } catch (error) {
    console.error('Block slot error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to block time slot',
      error: error.message
    });
  }
};

/**
 * Unblock Time Slot
 */
export const unblockTimeSlot = async (req, res) => {
  try {
    const { id } = req.params;

    const blockedSlot = await BlockedSlot.findByPk(id);

    if (!blockedSlot) {
      return res.status(404).json({
        success: false,
        message: 'Blocked slot not found'
      });
    }

    await blockedSlot.update({ isActive: false });

    res.json({
      success: true,
      message: 'Time slot unblocked successfully'
    });
  } catch (error) {
    console.error('Unblock slot error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to unblock time slot',
      error: error.message
    });
  }
};

/**
 * Get All Blocked Slots
 */
export const getBlockedSlots = async (req, res) => {
  try {
    const { date, groundId } = req.query;

    const where = { isActive: true };
    
    if (date) {
      where.date = date;
    }
    
    if (groundId) {
      where.groundId = groundId;
    }

    const blockedSlots = await BlockedSlot.findAll({
      where,
      include: [
        {
          model: Ground,
          as: 'ground',
          attributes: ['id', 'name', 'description']
        },
        {
          model: Admin,
          as: 'admin',
          attributes: ['id', 'username']
        }
      ],
      order: [['date', 'ASC'], ['timeSlot', 'ASC']]
    });

    res.json({
      success: true,
      data: { blockedSlots }
    });
  } catch (error) {
    console.error('Get blocked slots error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch blocked slots',
      error: error.message
    });
  }
};

export default {
  login,
  getAllBookings,
  searchBooking,
  getStatistics,
  blockTimeSlot,
  unblockTimeSlot,
  getBlockedSlots
};

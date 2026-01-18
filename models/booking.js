/**
 * ============================================================================
 * BOOKING MODEL
 * ============================================================================
 * 
 * Represents a turf booking with complete payment tracking.
 * 
 * Booking Flow:
 * 1. User selects date, time, and ground
 * 2. Creates booking with status 'pending'
 * 3. Razorpay order is created (status changes to 'processing')
 * 4. User completes payment on Razorpay
 * 5. Payment is verified (status changes to 'paid')
 * 6. If payment fails, status becomes 'failed'
 * 7. Refunds can be processed (status becomes 'refunded')
 * 
 * Payment Status Values:
 * - pending: Booking created, payment not initiated
 * - processing: Payment gateway opened, awaiting user action
 * - paid: Payment successful and verified
 * - failed: Payment failed or verification failed
 * - refunded: Payment was refunded to user
 * 
 * Conflict Prevention:
 * - Cannot book same ground at same time
 * - Cannot book past time slots
 * - Mega_Ground booking blocks both G1 and G2
 * - G1 or G2 booking blocks Mega_Ground
 * 
 * ============================================================================
 */

export default (sequelize, DataTypes) => {
  const Booking = sequelize.define('Booking', {
    // ========================================================================
    // PRIMARY KEY
    // ========================================================================
    
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      comment: 'Unique identifier for the booking'
    },
    
    // ========================================================================
    // CUSTOMER INFORMATION
    // ========================================================================
    
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [2, 100]
      },
      comment: 'Customer full name'
    },
    
    phone: {
      type: DataTypes.BIGINT,
      allowNull: false,
      validate: {
        isNumeric: true,
        len: [10, 15]
      },
      comment: 'Customer phone number (10-15 digits)'
    },
    
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        isEmail: true
      },
      comment: 'Customer email address'
    },
    
    // ========================================================================
    // BOOKING DETAILS
    // ========================================================================
    
    groundId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: 'Foreign key referencing the Ground table'
    },
    
    startTime: {
      type: DataTypes.DATE,
      allowNull: false,
      comment: 'Booking start date and time'
    },
    
    endTime: {
      type: DataTypes.DATE,
      allowNull: false,
      comment: 'Booking end date and time'
    },
    
    duration: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        min: 1,
        max: 24
      },
      comment: 'Booking duration in hours'
    },
    
    totalAmount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      validate: {
        min: 0
      },
      comment: 'Total booking amount in INR'
    },
    
    // ========================================================================
    // PAYMENT STATUS & TRACKING
    // ========================================================================
    
    paymentStatus: {
      type: DataTypes.ENUM('pending', 'processing', 'paid', 'failed', 'refunded'),
      allowNull: false,
      defaultValue: 'pending',
      comment: 'Current payment status of the booking'
    },
    
    razorpayOrderId: {
      type: DataTypes.STRING,
      allowNull: true,
      unique: true,
      comment: 'Razorpay order ID from payment gateway'
    },
    
    razorpayPaymentId: {
      type: DataTypes.STRING,
      allowNull: true,
      unique: true,
      comment: 'Razorpay payment ID after successful payment'
    },
    
    razorpaySignature: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Payment signature for verification (HMAC SHA256)'
    },
    
    paymentMethod: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Payment method used (UPI, card, netbanking, etc.)'
    },
    
    bookingType: {
      type: DataTypes.ENUM('online', 'offline'),
      allowNull: false,
      defaultValue: 'online',
      comment: 'Booking type: online (via website) or offline (walk-in)'
    },
    
    paymentAttempts: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      allowNull: false,
      comment: 'Number of payment attempts made'
    },
    
    paymentCompletedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Timestamp when payment was successfully completed'
    },
    
    paymentFailureReason: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Reason for payment failure (if any)'
    }
  }, {
    // Enable timestamps
    timestamps: true,
    
    // Table name
    tableName: 'Bookings',
    
    // Model name
    modelName: 'Booking',
    
    // Add indexes for better query performance
    indexes: [
      // Index for finding bookings by ground and date range
      {
        fields: ['groundId', 'startTime', 'endTime']
      },
      // Index for finding bookings by payment status
      {
        fields: ['paymentStatus']
      },
      // Index for finding bookings by customer email
      {
        fields: ['email']
      },
      // Index for finding bookings by Razorpay order ID
      {
        unique: true,
        fields: ['razorpayOrderId'],
        where: {
          razorpayOrderId: {
            [sequelize.Sequelize.Op.ne]: null
          }
        }
      }
    ]
  });

  /**
   * Define associations with other models
   * 
   * A Booking belongs to a Ground:
   * - Each booking is associated with exactly one ground
   * - If ground is deleted, bookings are also deleted (CASCADE)
   */
  Booking.associate = (models) => {
    Booking.belongsTo(models.Ground, { 
      foreignKey: 'groundId',
      as: 'ground',
      onDelete: 'CASCADE'
    });
  };

  return Booking;
};
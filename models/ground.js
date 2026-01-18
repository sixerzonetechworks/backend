/**
 * ============================================================================
 * GROUND MODEL
 * ============================================================================
 * 
 * Represents a turf ground/field available for booking.
 * 
 * Ground Types:
 * - G1: Individual ground 1
 * - G2: Individual ground 2
 * - Mega_Ground: Combined ground (G1 + G2) - booking this blocks both G1 and G2
 * 
 * Pricing Structure:
 * Pricing is stored as JSON with different rates for:
 * - Weekday_first_half: Monday-Friday, 12:00 AM - 11:59 AM
 * - Weekday_second_half: Monday-Friday, 12:00 PM - 11:59 PM
 * - Weekend_first_half: Saturday-Sunday, 12:00 AM - 11:59 AM
 * - Weekend_second_half: Saturday-Sunday, 12:00 PM - 11:59 PM
 * 
 * Example pricing JSON:
 * {
 *   "Weekday_first_half": 800,
 *   "Weekday_second_half": 1000,
 *   "Weekend_first_half": 1200,
 *   "Weekend_second_half": 1500
 * }
 * 
 * Relationships:
 * - Has many Bookings (one ground can have multiple bookings)
 * 
 * ============================================================================
 */

export default (sequelize, DataTypes) => {
  const Ground = sequelize.define('Ground', {
    // Primary key - auto-incrementing ID
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      comment: 'Unique identifier for the ground'
    },
    
    // Ground name - restricted to specific values
    name: {
      type: DataTypes.ENUM('G1', 'G2', 'Mega_Ground'),
      allowNull: false,
      unique: true,
      comment: 'Ground identifier - G1, G2, or Mega_Ground (combination of G1+G2)'
    },
    
    // Ground description - optional field for additional details
    description: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Brief description of the ground facilities and features'
    },
    
    // Pricing structure - stored as JSON for flexibility
    pricing: {
      type: DataTypes.JSON,
      allowNull: false,
      comment: 'JSON object containing pricing for different time slots (weekday/weekend, first/second half)'
    }
  }, {
    // Enable timestamps (createdAt, updatedAt)
    timestamps: true,
    
    // Table name in database
    tableName: 'Grounds',
    
    // Model name
    modelName: 'Ground',
    
    // Add indexes for better query performance
    indexes: [
      {
        unique: true,
        fields: ['name']
      }
    ]
  });

  /**
   * Define associations with other models
   * 
   * A Ground has many Bookings:
   * - One ground can have multiple bookings over time
   * - Cascade delete: if a ground is deleted, all its bookings are also deleted
   */
  Ground.associate = (models) => {
    Ground.hasMany(models.Booking, { 
      foreignKey: 'groundId',
      as: 'bookings',
      onDelete: 'CASCADE'
    });
  };

  return Ground;
};
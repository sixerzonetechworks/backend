/**
 * BlockedSlot Model
 * Represents manually blocked time slots by admin
 */

import { DataTypes } from 'sequelize';

export default (sequelize) => {
  const BlockedSlot = sequelize.define('BlockedSlot', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    date: {
      type: DataTypes.DATEONLY,
      allowNull: false
    },
    timeSlot: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: 'Time slot in format: HH:MM - HH:MM'
    },
    groundId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Null means all grounds are blocked for this slot'
    },
    reason: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Reason for blocking (e.g., "Offline booking", "Maintenance")'
    },
    blockedBy: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: 'Admin ID who blocked this slot'
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      allowNull: false
    }
  }, {
    tableName: 'blocked_slots',
    timestamps: true,
    indexes: [
      {
        fields: ['date', 'timeSlot', 'groundId']
      },
      {
        fields: ['isActive']
      }
    ]
  });

  BlockedSlot.associate = (models) => {
    BlockedSlot.belongsTo(models.Ground, { 
      foreignKey: 'groundId', 
      as: 'ground' 
    });
    BlockedSlot.belongsTo(models.Admin, { 
      foreignKey: 'blockedBy', 
      as: 'admin' 
    });
  };

  return BlockedSlot;
};

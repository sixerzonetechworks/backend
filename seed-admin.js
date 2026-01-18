/**
 * Seed Admin User
 * Creates a default admin user for testing
 * Run with: node seed-admin.js
 */

import 'dotenv/config';
import bcrypt from 'bcryptjs';
import db from './models/index.js';

const { Admin, sequelize } = db;

async function seedAdmin() {
  try {
    await sequelize.sync();

    // Check if admin already exists
    const existingAdmin = await Admin.findOne({ where: { username: 'admin' } });
    
    if (existingAdmin) {
      console.log('❌ Admin user already exists');
      process.exit(0);
    }

    // Hash password
    const hashedPassword = await bcrypt.hash('admin123', 10);

    // Create admin user
    await Admin.create({
      username: 'admin',
      password: hashedPassword,
      email: 'admin@sixerzone.com',
      role: 'admin',
      isActive: true
    });

    console.log('✅ Admin user created successfully');
    console.log('📧 Username: admin');
    console.log('🔑 Password: admin123');
    console.log('⚠️  Please change the password after first login');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding admin:', error);
    process.exit(1);
  }
}

seedAdmin();

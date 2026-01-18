import db from './models/index.js';
import 'dotenv/config';

async function seedData() {
  try {
    await db.sequelize.sync();
    
    // Check if grounds already exist
    const existingGrounds = await db.Ground.findAll();
    
    if (existingGrounds.length > 0) {
      console.log('✓ Grounds already exist in database');
      console.log(`Found ${existingGrounds.length} grounds:`, existingGrounds.map(g => g.name));
      process.exit(0);
    }
    
    // Create grounds
    const grounds = await db.Ground.bulkCreate([
      {
        name: 'G1',
        location: 'Area A - Main Ground',
        pricing: {
          Weekday_first_half: 1000,
          Weekday_second_half: 1200,
          Weekend_first_half: 1500,
          Weekend_second_half: 1800
        }
      },
      {
        name: 'G2',
        location: 'Area B - Secondary Ground',
        pricing: {
          Weekday_first_half: 1000,
          Weekday_second_half: 1200,
          Weekend_first_half: 1500,
          Weekend_second_half: 1800
        }
      },
      {
        name: 'Mega_Ground',
        location: 'Combined Ground (G1 + G2)',
        pricing: {
          Weekday_first_half: 1800,
          Weekday_second_half: 2200,
          Weekend_first_half: 2800,
          Weekend_second_half: 3400
        }
      }
    ]);
    
    console.log('✓ Successfully created grounds:');
    grounds.forEach(g => console.log(`  - ${g.name}: ${g.location}`));
    
    process.exit(0);
  } catch (error) {
    console.error('Error seeding data:', error);
    process.exit(1);
  }
}

seedData();

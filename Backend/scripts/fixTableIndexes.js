// scripts/fixTableIndexes.js
const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
    console.log('MongoDB connected successfully');
    try {
      await fixTableIndexes();
    } catch (error) {
      console.error('Error fixing indexes:', error);
    } finally {
      mongoose.connection.close();
      console.log('MongoDB connection closed');
    }
  })
  .catch((error) => {
    console.error('Error connecting to MongoDB:', error);
    process.exit(1);
  });

// Define a simple schema for the Table model if it doesn't exist
// This is just for accessing the collection, we don't need the full schema
const tableSchema = new mongoose.Schema({
  restaurant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Restaurant',
    required: true
  },
  tableNumber: {
    type: String,
    required: true
  }
});

// Only create the model if it doesn't already exist
let Table;
try {
  Table = mongoose.model('Table');
} catch (e) {
  Table = mongoose.model('Table', tableSchema);
}

// Main function to fix indexes
async function fixTableIndexes() {
  try {
    console.log('Starting Table indexes cleanup...');

    // Get the table collection directly
    const tableCollection = mongoose.connection.db.collection('tables');
    
    // Check existing indexes
    const existingIndexes = await tableCollection.indexes();
    console.log('Current indexes:', JSON.stringify(existingIndexes, null, 2));
    
    // Drop any existing index on tableNumber only
    try {
      await tableCollection.dropIndex('tableNumber_1');
      console.log('Dropped simple tableNumber index');
    } catch (err) {
      console.log('No simple tableNumber index found (or error dropping):', err.message);
    }
    
    // Check for tables with invalid restaurant references
    const tablesWithoutRestaurant = await tableCollection.find({
      $or: [
        { restaurant: null },
        { restaurant: { $exists: false } }
      ]
    }).toArray();
    
    if (tablesWithoutRestaurant.length > 0) {
      console.log(`Found ${tablesWithoutRestaurant.length} tables without restaurant ID. Removing them...`);
      await tableCollection.deleteMany({
        $or: [
          { restaurant: null },
          { restaurant: { $exists: false } }
        ]
      });
      console.log('Removed tables with missing restaurant IDs');
    } else {
      console.log('No tables found with missing restaurant IDs');
    }
    
    // Recreate the correct compound index
    await tableCollection.createIndex(
      { restaurant: 1, tableNumber: 1 },
      { unique: true }
    );
    console.log('Successfully created compound index on restaurant+tableNumber');
    
    // Verify the indexes now
    const updatedIndexes = await tableCollection.indexes();
    console.log('Updated indexes:', JSON.stringify(updatedIndexes, null, 2));
    
    console.log('Table indexes cleanup completed successfully!');
  } catch (error) {
    console.error('Error fixing table indexes:', error);
    throw error;
  }
}
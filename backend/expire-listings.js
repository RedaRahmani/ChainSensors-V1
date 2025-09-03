const { MongoClient } = require('mongodb');

async function expireListings() {
  const uri = "mongodb+srv://mohamedredarahmani20:Reda0987@cluster0.yf03kut.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
  
  const client = new MongoClient(uri);
  
  try {
    console.log('🔗 Connecting to MongoDB Atlas...');
    await client.connect();
    
    const db = client.db('test'); // Use 'test' as default database
    const collection = db.collection('listings');
    
    console.log('✅ Connected to MongoDB Atlas');
    console.log('📊 Current database:', db.databaseName);
    
    // First, let's check the current status distribution
    console.log('\n=== BEFORE UPDATE ===');
    const beforeStats = await collection.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      },
      {
        $project: {
          status: {
            $switch: {
              branches: [
                { case: { $eq: ['$_id', 0] }, then: 'Pending' },
                { case: { $eq: ['$_id', 1] }, then: 'Active' },
                { case: { $eq: ['$_id', 2] }, then: 'Cancelled/Expired' },
                { case: { $eq: ['$_id', 3] }, then: 'Sold' }
              ],
              default: 'Unknown'
            }
          },
          count: 1
        }
      }
    ]).toArray();
    
    console.table(beforeStats);
    
    // Execute the update command
    console.log('\n=== EXECUTING UPDATE ===');
    console.log('📝 Running: db.listings.updateMany({ status: 1 }, { $set: { status: 2, updatedAt: new Date() } })');
    
    const result = await collection.updateMany(
      { status: 1 },
      { $set: { status: 2, updatedAt: new Date() } }
    );
    
    console.log('\n📊 Update result:');
    console.log('   - Acknowledged:', result.acknowledged);
    console.log('   - Matched count:', result.matchedCount);
    console.log('   - Modified count:', result.modifiedCount);
    
    // Check the status distribution after update
    console.log('\n=== AFTER UPDATE ===');
    const afterStats = await collection.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      },
      {
        $project: {
          status: {
            $switch: {
              branches: [
                { case: { $eq: ['$_id', 0] }, then: 'Pending' },
                { case: { $eq: ['$_id', 1] }, then: 'Active' },
                { case: { $eq: ['$_id', 2] }, then: 'Cancelled/Expired' },
                { case: { $eq: ['$_id', 3] }, then: 'Sold' }
              ],
              default: 'Unknown'
            }
          },
          count: 1
        }
      }
    ]).toArray();
    
    console.table(afterStats);
    
    console.log('\n✅ All active listings have been expired (status = 2)');
    console.log('🚀 The marketplace will now show no active listings until new ones are created');
    
    if (result.modifiedCount > 0) {
      console.log(`\n🎯 Successfully expired ${result.modifiedCount} active listing(s)`);
    } else {
      console.log('\n💡 No active listings found to expire');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.close();
    console.log('\n🔌 Connection closed');
  }
}

expireListings();

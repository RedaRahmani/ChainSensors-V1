const { MongoClient } = require('mongodb');

async function expireListings() {
  const uri = "mongodb+srv://mohamedredarahmani20:Reda0987@cluster0.yf03kut.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
  
  console.log('🔗 Connecting to MongoDB Atlas...');
  
  const client = new MongoClient(uri, {
    serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of 30s
  });
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB Atlas');
    
    const db = client.db('test');
    const collection = db.collection('listings');
    
    console.log('📊 Database:', db.databaseName);
    
    // Get current count of active listings
    const activeCount = await collection.countDocuments({ status: 1 });
    console.log(`📋 Found ${activeCount} active listing(s) to expire`);
    
    if (activeCount === 0) {
      console.log('💡 No active listings found to expire');
      return;
    }
    
    // Execute the update command
    console.log('\n📝 Executing: updateMany({ status: 1 }, { $set: { status: 2, updatedAt: new Date() } })');
    
    const result = await collection.updateMany(
      { status: 1 },
      { $set: { status: 2, updatedAt: new Date() } }
    );
    
    console.log('\n📊 Results:');
    console.log(`   ✅ Acknowledged: ${result.acknowledged}`);
    console.log(`   🎯 Matched: ${result.matchedCount}`);
    console.log(`   ✏️  Modified: ${result.modifiedCount}`);
    
    // Verify the update
    const newActiveCount = await collection.countDocuments({ status: 1 });
    const expiredCount = await collection.countDocuments({ status: 2 });
    
    console.log('\n📊 Final Status:');
    console.log(`   🟢 Active listings: ${newActiveCount}`);
    console.log(`   🔴 Expired listings: ${expiredCount}`);
    
    console.log('\n✅ SUCCESS: All active listings have been expired!');
    console.log('🚀 The marketplace will now show no active listings until new ones are created');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await client.close();
    console.log('\n🔌 Connection closed');
  }
}

expireListings().catch(console.error);

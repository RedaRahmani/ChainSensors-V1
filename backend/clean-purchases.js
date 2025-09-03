const { MongoClient } = require('mongodb');

async function cleanPurchaseData() {
  const uri = "mongodb+srv://mohamedredarahmani20:Reda0987@cluster0.yf03kut.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
  
  console.log('🔗 Connecting to MongoDB Atlas...');
  
  const client = new MongoClient(uri, {
    serverSelectionTimeoutMS: 5000,
  });
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB Atlas');
    
    const db = client.db('test');
    
    console.log('📊 Database:', db.databaseName);
    
    // Get collections that might contain purchase-related data
    const collections = [
      'resealedcapsules',
      'qualitymetrics', 
      'readings',
      'indexer_states'
    ];
    
    console.log('\n📋 Checking collections for purchase-related data...');
    
    const results = {};
    
    for (const collectionName of collections) {
      try {
        const collection = db.collection(collectionName);
        const count = await collection.countDocuments();
        console.log(`   📦 ${collectionName}: ${count} documents`);
        results[collectionName] = { before: count };
      } catch (error) {
        console.log(`   ❌ ${collectionName}: Collection not found or error`);
        results[collectionName] = { before: 0, error: error.message };
      }
    }
    
    // Clean ResealedCapsules (purchase-related encrypted data)
    console.log('\n🧹 CLEANING RESEALED CAPSULES...');
    try {
      const resealedResult = await db.collection('resealedcapsules').deleteMany({});
      console.log(`   ✅ Deleted ${resealedResult.deletedCount} resealed capsules`);
      results.resealedcapsules.deleted = resealedResult.deletedCount;
    } catch (error) {
      console.log(`   ❌ Error cleaning resealed capsules: ${error.message}`);
    }
    
    // Clean QualityMetrics (device quality data)
    console.log('\n🧹 CLEANING QUALITY METRICS...');
    try {
      const qualityResult = await db.collection('qualitymetrics').deleteMany({});
      console.log(`   ✅ Deleted ${qualityResult.deletedCount} quality metrics`);
      results.qualitymetrics.deleted = qualityResult.deletedCount;
    } catch (error) {
      console.log(`   ❌ Error cleaning quality metrics: ${error.message}`);
    }
    
    // Clean Readings (sensor data readings)
    console.log('\n🧹 CLEANING READINGS...');
    try {
      const readingsResult = await db.collection('readings').deleteMany({});
      console.log(`   ✅ Deleted ${readingsResult.deletedCount} readings`);
      results.readings.deleted = readingsResult.deletedCount;
    } catch (error) {
      console.log(`   ❌ Error cleaning readings: ${error.message}`);
    }
    
    // Reset Indexer States (this will force re-indexing from the beginning)
    console.log('\n🧹 RESETTING INDEXER STATES...');
    try {
      const indexerResult = await db.collection('indexer_states').updateMany(
        {},
        { 
          $set: { 
            lastProcessedSlot: 0, 
            lastProcessedSig: '',
            updatedAt: new Date()
          }
        }
      );
      console.log(`   ✅ Reset ${indexerResult.modifiedCount} indexer states`);
      results.indexer_states.reset = indexerResult.modifiedCount;
    } catch (error) {
      console.log(`   ❌ Error resetting indexer states: ${error.message}`);
    }
    
    // Final verification
    console.log('\n📊 FINAL STATUS:');
    for (const collectionName of collections) {
      try {
        const collection = db.collection(collectionName);
        const count = await collection.countDocuments();
        console.log(`   📦 ${collectionName}: ${count} documents remaining`);
        results[collectionName].after = count;
      } catch (error) {
        console.log(`   ❌ ${collectionName}: Error checking final count`);
      }
    }
    
    console.log('\n✅ PURCHASE DATA CLEANUP COMPLETED!');
    console.log('📝 Summary:');
    console.table(results);
    
    console.log('\n🚀 IMPORTANT NOTES:');
    console.log('   • MongoDB collections have been cleaned');
    console.log('   • On-chain purchase records (Solana) are NOT affected');
    console.log('   • The purchases will still show in the UI until:');
    console.log('     - You create a new wallet/keypair, OR');
    console.log('     - The indexer re-processes and rebuilds the data');
    console.log('   • To completely clear purchases, you would need to use a different wallet');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await client.close();
    console.log('\n🔌 Connection closed');
  }
}

cleanPurchaseData().catch(console.error);

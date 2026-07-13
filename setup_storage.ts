import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://tmkhmndwmaxzozluqkme.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

async function setupBuckets() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  
  const bucketsToCreate = ['event-photos', 'user-photos'];

  for (const bucketName of bucketsToCreate) {
    console.log(`Checking bucket: ${bucketName}`);
    const { data: bucket, error: getError } = await supabase.storage.getBucket(bucketName);
    
    if (getError && getError.message.includes('not found')) {
      console.log(`Creating public bucket: ${bucketName}`);
      const { data, error } = await supabase.storage.createBucket(bucketName, {
        public: true,
        fileSizeLimit: 52428800 // 50MB
      });
      if (error) {
        console.error(`Failed to create ${bucketName}:`, error);
      } else {
        console.log(`Successfully created ${bucketName}`);
      }
    } else if (bucket) {
      console.log(`${bucketName} already exists.`);
    } else {
      console.error(`Error checking ${bucketName}:`, getError);
    }
  }
}

setupBuckets().catch(console.error);

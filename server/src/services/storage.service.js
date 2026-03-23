const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

class StorageService {
  /**
   * Upload a file buffer to Supabase Storage.
   * Appends a timestamp to the path to bust CDN cache on re-uploads.
   * @param {string} bucket - Storage bucket name
   * @param {string} path - File path within the bucket (timestamp appended automatically)
   * @param {Buffer} buffer - File contents
   * @param {string} mimetype - MIME type (e.g. 'image/png')
   * @returns {string} Public URL of the uploaded file
   */
  static async uploadFile(bucket, path, buffer, mimetype) {
    // Append timestamp to bust CDN cache when replacing images
    const ext = mimetype === 'image/png' ? '.png' 
               : mimetype === 'image/jpeg' ? '.jpg' 
               : mimetype === 'image/webp' ? '.webp' 
               : '';
    const cacheBustedPath = `${path}_${Date.now()}${ext}`;

    const { error } = await supabase.storage
      .from(bucket)
      .upload(cacheBustedPath, buffer, {
        contentType: mimetype,
        upsert: false,
      });

    if (error) {
      throw new Error(`Storage upload failed: ${error.message}`);
    }

    const { data } = supabase.storage
      .from(bucket)
      .getPublicUrl(cacheBustedPath);
      
    return data.publicUrl;
  }
}

module.exports = StorageService;

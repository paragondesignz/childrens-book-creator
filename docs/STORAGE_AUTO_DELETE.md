# 48-Hour Auto-Delete Configuration

## Overview

For **privacy and security reasons**, all generated PDFs and images are automatically deleted after 48 hours. This ensures:
- User data privacy compliance
- Reduced storage costs
- GDPR compliance for temporary data retention

## Implementation

### Supabase Storage Buckets

Configure lifecycle rules for the following storage buckets:

#### 1. `generated-pdfs` Bucket
```sql
-- Set object expiration to 48 hours (172800 seconds)
-- This must be configured in Supabase Dashboard under Storage > Buckets > generated-pdfs > Settings
-- Or via Supabase CLI/API
```

**Supabase Dashboard Configuration:**
1. Go to Storage > `generated-pdfs`
2. Click Settings
3. Set "Auto-delete files after": 48 hours (172800 seconds)
4. Save

#### 2. `generated-images` Bucket
```sql
-- Set object expiration to 48 hours
-- Configuration in Supabase Dashboard under Storage > Buckets > generated-images > Settings
```

**Supabase Dashboard Configuration:**
1. Go to Storage > `generated-images`
2. Click Settings
3. Set "Auto-delete files after": 48 hours (172800 seconds)
4. Save

### Notes

- **Database Records**: The database records in `generated_pdfs` and `generated_images` tables will remain after 48 hours. The `image_url` and `pdf_url` fields will point to expired/deleted files.
- **User Experience**: Users should download their books within 48 hours of generation
- **Thumbnails Removed**: Thumbnail generation has been removed to save storage space and processing time
- **Uploaded Images**: User-uploaded photos (`uploaded-images` bucket) can have shorter expiry (24 hours) as they're only needed during generation

## User Communication

Add the following notices in the application:

### After Book Generation
> ⚠️ **Important**: Your book will be available for download for 48 hours. Please download it now to keep a permanent copy.

### In Dashboard
Show remaining time until deletion:
```typescript
const hoursRemaining = Math.max(0, 48 - Math.floor((Date.now() - new Date(book.created_at).getTime()) / (1000 * 60 * 60)));
if (hoursRemaining < 24) {
  // Show warning
}
```

## Alternative: Database-Triggered Cleanup

If Supabase storage doesn't support automatic deletion, implement a cron job:

```typescript
// app/api/cron/cleanup-old-files/route.ts
export async function GET(request: Request) {
  const supabase = createClient();

  const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

  // Find old books
  const { data: oldBooks } = await supabase
    .from('book_orders')
    .select('id')
    .eq('status', 'completed')
    .lt('created_at', fortyEightHoursAgo);

  for (const book of oldBooks || []) {
    // Delete storage files
    const { data: files } = await supabase.storage
      .from('generated-images')
      .list(book.id);

    if (files) {
      await supabase.storage
        .from('generated-images')
        .remove(files.map(f => `${book.id}/${f.name}`));
    }

    await supabase.storage
      .from('generated-pdfs')
      .remove([`${book.id}/book.pdf`]);
  }

  return Response.json({ success: true });
}
```

Then set up a Vercel cron or similar to call this endpoint daily.

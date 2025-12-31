import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env.local
config({ path: resolve(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const IMAGE_MODELS = [
  { name: 'gemini-3-pro-image-preview', label: 'Gemini 3 Pro' },
  { name: 'gemini-2.5-flash-image', label: 'Gemini 2.5 Flash' },
];

async function generateImage(questionId: string, questionContent: string): Promise<boolean> {
  const apiKey = process.env.GEMINI_API_KEY;
  
  const prompt = `Create a visually appealing illustration for this yes/no question: "${questionContent}".

Style guidelines:
- Modern flat illustration style with clean lines
- Include recognizable objects or scenes that relate to the question's topic
- Vibrant but harmonious color palette (2-4 colors)
- Simple composition, not cluttered
- No text or words in the image
- Suitable as a social media thumbnail

Make it immediately clear what topic the question is about.`;

  let imageData: string | null = null;
  let mimeType = 'image/png';
  let usedModel = '';

  for (const model of IMAGE_MODELS) {
    console.log(`  Trying ${model.label}...`);
    
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model.name}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseModalities: ['IMAGE', 'TEXT'],
          },
        }),
      }
    );

    if (!response.ok) {
      const isRateLimit = response.status === 429;
      console.log(`  ${model.label} ${isRateLimit ? 'rate limited' : 'failed'}: ${response.status}`);
      continue;
    }

    const data = await response.json();
    
    for (const part of data.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        imageData = part.inlineData.data;
        mimeType = part.inlineData.mimeType || 'image/png';
        usedModel = model.label;
        break;
      }
    }

    if (imageData) {
      console.log(`  ✓ Generated with ${model.label}`);
      break;
    }
  }

  if (!imageData) {
    console.log('  ✗ All models failed');
    return false;
  }

  // Upload to Supabase Storage
  const imageBuffer = Buffer.from(imageData, 'base64');
  const fileExtension = mimeType.split('/')[1] || 'png';
  const fileName = `question-images/${questionId}.${fileExtension}`;

  const { error: uploadError } = await supabase.storage
    .from('images')
    .upload(fileName, imageBuffer, {
      contentType: mimeType,
      upsert: true,
    });

  if (uploadError) {
    console.error('  ✗ Upload failed:', uploadError.message);
    return false;
  }

  // Get public URL
  const { data: urlData } = supabase.storage.from('images').getPublicUrl(fileName);
  const imageUrl = urlData.publicUrl;

  // Update question
  const { error: updateError } = await supabase
    .from('questions')
    .update({ image_url: imageUrl, image_model: usedModel })
    .eq('id', questionId);

  if (updateError) {
    console.error('  ✗ DB update failed:', updateError.message);
    return false;
  }

  console.log(`  ✓ Uploaded and saved: ${imageUrl}`);
  return true;
}

async function main() {
  console.log('Fetching questions from last 60 minutes without images...\n');
  
  const sixtyMinutesAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  
  const { data: questions, error } = await supabase
    .from('questions')
    .select('id, content, image_url')
    .gte('created_at', sixtyMinutesAgo)
    .is('image_url', null)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching questions:', error);
    return;
  }

  console.log(`Found ${questions?.length || 0} questions without images\n`);

  if (!questions || questions.length === 0) {
    console.log('No questions need image regeneration');
    return;
  }

  let success = 0;
  let failed = 0;

  for (const question of questions) {
    console.log(`[${success + failed + 1}/${questions.length}] "${question.content.substring(0, 50)}..."`);
    
    const result = await generateImage(question.id, question.content);
    if (result) success++;
    else failed++;
    
    // Small delay between requests
    await new Promise(r => setTimeout(r, 1000));
  }

  console.log(`\nDone! Success: ${success}, Failed: ${failed}`);
}

main().catch(console.error);

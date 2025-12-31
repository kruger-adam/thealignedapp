import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// Models to try in order of preference (highest quality first)
// gemini-3-pro-image-preview: 20/day free - best quality
// gemini-2.5-flash-image: 500/day free - good quality, high limit
const IMAGE_MODELS = [
  { name: 'gemini-3-pro-image-preview', label: 'Gemini 3 Pro' },
  { name: 'gemini-2.5-flash-image', label: 'Gemini 2.5 Flash' },
];

export async function POST(request: Request) {
  try {
    const { questionId, questionContent } = await request.json();

    if (!questionContent) {
      return NextResponse.json({ error: 'Question content is required' }, { status: 400 });
    }

    const supabase = getSupabase();
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ error: 'GEMINI_API_KEY not configured' }, { status: 500 });
    }

    // Simpler prompt = potentially smaller/simpler image output
    const prompt = `Simple flat illustration for: "${questionContent}". Minimal style, 2-3 colors, no text, clean icon-like design.`;

    console.log('Generating image for question:', questionContent);

    // Try each model in order until one succeeds
    let imageData: string | null = null;
    let mimeType = 'image/png';
    let usedModel = '';

    for (const model of IMAGE_MODELS) {
      console.log(`Trying ${model.label} (${model.name})...`);
      
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model.name}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              responseModalities: ['IMAGE', 'TEXT'],
              // Request smaller image to reduce token usage
              // Square aspect ratio typically produces smaller files
            },
            // Image generation config
            imageGenerationConfig: {
              aspectRatio: '1:1', // Square (smaller than 16:9)
              numberOfImages: 1,
            },
          }),
        }
      );

      if (!response.ok) {
        const isRateLimit = response.status === 429;
        console.log(`${model.label} ${isRateLimit ? 'rate limited' : 'failed'}: ${response.status}`);
        
        // If rate limited (quota exceeded), try next model
        // If other error, also try next model
        continue;
      }

      const data = await response.json();
      
      // Find image part in response
      for (const part of data.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          imageData = part.inlineData.data;
          mimeType = part.inlineData.mimeType || 'image/png';
          usedModel = model.label;
          break;
        }
      }

      if (imageData) {
        console.log(`✓ Image generated with ${model.label}`);
        break;
      }
    }

    if (!imageData) {
      console.error('All models failed to generate image');
      return NextResponse.json({ error: 'Failed to generate image' }, { status: 500 });
    }

    // Convert base64 to buffer for upload
    const imageBuffer = Buffer.from(imageData, 'base64');
    const fileExtension = mimeType.split('/')[1] || 'png';
    const fileName = `question-images/${questionId || Date.now()}.${fileExtension}`;

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('images')
      .upload(fileName, imageBuffer, {
        contentType: mimeType,
        upsert: true,
      });

    if (uploadError) {
      console.error('Error uploading image to storage:', uploadError);
      return NextResponse.json({ error: 'Failed to upload image' }, { status: 500 });
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('images')
      .getPublicUrl(fileName);

    const imageUrl = urlData.publicUrl;

    // If questionId provided, update the question with the image URL and model used
    if (questionId) {
      const { error: updateError } = await supabase
        .from('questions')
        .update({ 
          image_url: imageUrl,
          image_model: usedModel,
        })
        .eq('id', questionId);

      if (updateError) {
        console.error('Error updating question with image URL:', updateError);
      }
    }

    console.log(`Image generated (${usedModel}) and uploaded:`, imageUrl);

    return NextResponse.json({
      success: true,
      imageUrl,
      model: usedModel,
    });
  } catch (error) {
    console.error('Error generating image:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

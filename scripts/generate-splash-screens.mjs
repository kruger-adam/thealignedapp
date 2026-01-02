import sharp from 'sharp';
import { readFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');

// iOS device splash screen sizes (width x height)
// Format: [width, height, devicePixelRatio, description]
const SPLASH_SCREENS = [
  // iPhones
  [640, 1136, 2, 'iPhone SE (1st gen)'],
  [750, 1334, 2, 'iPhone 6/7/8/SE2/SE3'],
  [1242, 2208, 3, 'iPhone 6+/7+/8+'],
  [1125, 2436, 3, 'iPhone X/XS/11 Pro'],
  [828, 1792, 2, 'iPhone XR/11'],
  [1242, 2688, 3, 'iPhone XS Max/11 Pro Max'],
  [1170, 2532, 3, 'iPhone 12/12 Pro/13/13 Pro/14'],
  [1284, 2778, 3, 'iPhone 12 Pro Max/13 Pro Max/14 Plus'],
  [1179, 2556, 3, 'iPhone 14 Pro/15/15 Pro/16/16 Pro'],
  [1290, 2796, 3, 'iPhone 14 Pro Max/15 Plus/15 Pro Max/16 Plus'],
  [1080, 2340, 3, 'iPhone 12 mini/13 mini'],
  [1206, 2622, 3, 'iPhone 16 Pro'],
  [1320, 2868, 3, 'iPhone 16 Pro Max'],
  // iPads
  [1668, 2388, 2, 'iPad Pro 11"'],
  [2048, 2732, 2, 'iPad Pro 12.9"'],
  [1640, 2360, 2, 'iPad Air 10.9"'],
  [1620, 2160, 2, 'iPad 10.2"'],
  [1536, 2048, 2, 'iPad Mini/Air'],
];

const BACKGROUND_COLOR = { r: 9, g: 9, b: 11, alpha: 1 }; // #09090b
const LOGO_SIZE_RATIO = 0.15; // Logo will be 15% of the smaller dimension

async function generateSplashScreens() {
  const outputDir = join(projectRoot, 'public', 'splash');
  
  // Create output directory
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  // Load the logo
  const logoPath = join(projectRoot, 'public', 'logo-transparent.png');
  const logoBuffer = readFileSync(logoPath);
  
  console.log('Generating iOS splash screens...\n');

  for (const [width, height, dpr, description] of SPLASH_SCREENS) {
    const filename = `splash-${width}x${height}.png`;
    const outputPath = join(outputDir, filename);
    
    // Calculate logo size (based on smaller dimension)
    const smallerDim = Math.min(width, height);
    const logoSize = Math.round(smallerDim * LOGO_SIZE_RATIO);
    
    // Resize logo
    const resizedLogo = await sharp(logoBuffer)
      .resize(logoSize, logoSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .toBuffer();
    
    // Create background and composite logo in center
    await sharp({
      create: {
        width,
        height,
        channels: 4,
        background: BACKGROUND_COLOR,
      },
    })
      .composite([
        {
          input: resizedLogo,
          gravity: 'center',
        },
      ])
      .png()
      .toFile(outputPath);
    
    console.log(`✓ ${filename} (${description})`);
  }

  console.log(`\n✅ Generated ${SPLASH_SCREENS.length} splash screens in public/splash/`);
  
  // Generate the link tags for layout.tsx
  console.log('\n📋 Add these link tags to your <head>:\n');
  
  for (const [width, height, dpr] of SPLASH_SCREENS) {
    const cssWidth = width / dpr;
    const cssHeight = height / dpr;
    console.log(`<link rel="apple-touch-startup-image" href="/splash/splash-${width}x${height}.png" media="(device-width: ${cssWidth}px) and (device-height: ${cssHeight}px) and (-webkit-device-pixel-ratio: ${dpr}) and (orientation: portrait)" />`);
  }
}

generateSplashScreens().catch(console.error);


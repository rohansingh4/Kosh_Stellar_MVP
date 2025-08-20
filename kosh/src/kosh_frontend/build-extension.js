import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Copy extension files to dist folder after build
const copyExtensionFiles = () => {
  const distDir = path.join(__dirname, 'dist');
  
  // Ensure dist directory exists
  if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
  }

  // Copy manifest.json
  fs.copyFileSync(
    path.join(__dirname, 'manifest.json'),
    path.join(distDir, 'manifest.json')
  );

  // Copy background.js
  fs.copyFileSync(
    path.join(__dirname, 'background.js'),
    path.join(distDir, 'background.js')
  );

  // Copy content.js
  fs.copyFileSync(
    path.join(__dirname, 'content.js'),
    path.join(distDir, 'content.js')
  );

  // Copy popup files
  fs.copyFileSync(
    path.join(__dirname, 'popup.html'),
    path.join(distDir, 'popup.html')
  );
  
  fs.copyFileSync(
    path.join(__dirname, 'popup.js'),
    path.join(distDir, 'popup.js')
  );

  // Copy icons directory
  const iconsSourceDir = path.join(__dirname, 'icons');
  const iconsDestDir = path.join(distDir, 'icons');
  
  if (!fs.existsSync(iconsDestDir)) {
    fs.mkdirSync(iconsDestDir, { recursive: true });
  }

  if (fs.existsSync(iconsSourceDir)) {
    const iconFiles = fs.readdirSync(iconsSourceDir);
    iconFiles.forEach(file => {
      fs.copyFileSync(
        path.join(iconsSourceDir, file),
        path.join(iconsDestDir, file)
      );
    });
  }

  console.log('Extension files copied to dist folder successfully!');
};

copyExtensionFiles();

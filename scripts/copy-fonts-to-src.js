const fs = require('fs');
const path = require('path');

const publicFonts = path.join(__dirname, 'client', 'public', 'fonts');
const srcFonts = path.join(__dirname, 'client', 'src', 'fonts');

// Создаем папку src/fonts, если её нет
if (!fs.existsSync(srcFonts)) {
  fs.mkdirSync(srcFonts, { recursive: true });
}

// Копируем все шрифты из public/fonts в src/fonts
if (fs.existsSync(publicFonts)) {
  const files = fs.readdirSync(publicFonts).filter(f => f.endsWith('.ttf') || f.endsWith('.otf'));
  files.forEach(file => {
    const sourceFile = path.join(publicFonts, file);
    const destFile = path.join(srcFonts, file);
    fs.copyFileSync(sourceFile, destFile);
    console.log(`Copied: ${file}`);
  });
  console.log(`Total: ${files.length} files copied to src/fonts`);
} else {
  console.log(`Public fonts folder not found: ${publicFonts}`);
}




const fs = require('fs');
const path = require('path');

const sourceMontserrat = path.join(__dirname, 'docs', 'шрифт', 'шрифт', 'Montserrat');
const sourceMagistral = path.join(__dirname, 'docs', 'шрифт', 'шрифт', 'Magistral');
const destination = path.join(__dirname, 'client', 'public', 'fonts');

// Создаем папку fonts, если её нет
if (!fs.existsSync(destination)) {
  fs.mkdirSync(destination, { recursive: true });
}

// Копируем Montserrat
if (fs.existsSync(sourceMontserrat)) {
  const files = fs.readdirSync(sourceMontserrat).filter(f => f.endsWith('.ttf'));
  files.forEach(file => {
    const sourceFile = path.join(sourceMontserrat, file);
    const destFile = path.join(destination, file);
    fs.copyFileSync(sourceFile, destFile);
    console.log(`✓ Скопирован: ${file}`);
  });
  console.log(`✓ Montserrat: ${files.length} файлов скопировано`);
} else {
  console.log(`✗ Папка Montserrat не найдена: ${sourceMontserrat}`);
}

// Копируем Magistral
if (fs.existsSync(sourceMagistral)) {
  const ttfFiles = fs.readdirSync(sourceMagistral).filter(f => f.endsWith('.ttf'));
  const otfFiles = fs.readdirSync(sourceMagistral).filter(f => f.endsWith('.otf'));
  
  [...ttfFiles, ...otfFiles].forEach(file => {
    const sourceFile = path.join(sourceMagistral, file);
    const destFile = path.join(destination, file);
    fs.copyFileSync(sourceFile, destFile);
    console.log(`✓ Скопирован: ${file}`);
  });
  console.log(`✓ Magistral: ${ttfFiles.length + otfFiles.length} файлов скопировано`);
} else {
  console.log(`✗ Папка Magistral не найдена: ${sourceMagistral}`);
}

const totalFiles = fs.readdirSync(destination).length;
console.log(`\nГотово! Всего файлов в fonts/: ${totalFiles}`);




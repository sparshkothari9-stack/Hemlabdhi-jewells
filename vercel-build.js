const fs = require('fs');
const path = require('path');

const PUBLIC = path.join(__dirname, 'public');

function mkdirp(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function copyRecursive(src, dest) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    mkdirp(dest);
    for (const child of fs.readdirSync(src)) {
      copyRecursive(path.join(src, child), path.join(dest, child));
    }
  } else {
    fs.copyFileSync(src, dest);
  }
}

if (fs.existsSync(PUBLIC)) fs.rmSync(PUBLIC, { recursive: true });

const staticDirs = ['css', 'images', 'pages', 'js'];
const staticFiles = fs.readdirSync(__dirname).filter(f => f.endsWith('.html') || f.endsWith('.svg') || f.endsWith('.ico'));

mkdirp(PUBLIC);

for (const dir of staticDirs) {
  const src = path.join(__dirname, dir);
  if (fs.existsSync(src)) {
    copyRecursive(src, path.join(PUBLIC, dir));
  }
}

for (const file of staticFiles) {
  fs.copyFileSync(path.join(__dirname, file), path.join(PUBLIC, file));
}

console.log('[BUILD] Static files copied to public/');

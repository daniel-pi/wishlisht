const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const svgBuffer = fs.readFileSync('client/public/favicon.svg');

sharp(svgBuffer)
  .resize(180, 180)
  .png()
  .toFile('client/public/apple-touch-icon.png')
  .then(info => {
    console.log('Icon generated:', info);
  })
  .catch(err => {
    console.error('Error generating icon:', err);
    process.exit(1);
  });
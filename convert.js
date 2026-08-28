const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const input = 'public/images/logo/logo.svg';
const output = 'public/images/logo/logo.png';

console.log('Input:', input);
console.log('Exists:', fs.existsSync(input));

sharp(input)
    .resize(400, 400, { fit: 'inside', withoutEnlargement: false })
    .png()
    .toFile(output)
    .then(info => {
        console.log('SUCCESS: PNG created:', output);
        console.log('Size:', info.width, 'x', info.height);
        console.log('File size:', fs.statSync(output).size, 'bytes');
    })
    .catch(err => {
        console.error('ERROR:', err.message);
        console.error(err);
    });

console.log('Script started...');
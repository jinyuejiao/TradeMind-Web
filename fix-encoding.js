const fs = require('fs');
const path = require('path');

const filesToFix = [
    'modules/dashboard/dashboard.html',
    'modules/crm/crm.html',
    'modules/product-center/product-center.html',
    'modules/supply-chain/supply-chain.html'
];

filesToFix.forEach(file => {
    const filePath = path.join(__dirname, file);
    console.log(`Processing: ${file}`);
    
    try {
        let content = fs.readFileSync(filePath, 'utf8');
        
        const originalLength = content.length;
        
        content = content.replace(/http:\/\/localhost:8080/g, '');
        
        if (content.length !== originalLength) {
            console.log(`  Replaced hardcoded URLs in ${file}`);
        }
        
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`  Saved: ${file}`);
    } catch (error) {
        console.error(`Error processing ${file}:`, error.message);
    }
});

console.log('\nDone!');

const fs = require('fs');
const path = require('path');

const files = [
    { path: 'modules/dashboard/dashboard.html', needsEnv: true, needsApp: true, envPath: '../../assets/js/env-config.js', appPath: '../../assets/js/app.js' },
    { path: 'modules/crm/crm.html', needsEnv: true, needsApp: false, envPath: '../../assets/js/env-config.js' },
    { path: 'modules/product-center/product-center.html', needsEnv: true, needsApp: false, envPath: '../../assets/js/env-config.js' },
    { path: 'modules/supply-chain/supply-chain.html', needsEnv: true, needsApp: false, envPath: '../../assets/js/env-config.js' },
    { path: 'login.html', needsEnv: true, needsApp: false, envPath: './assets/js/env-config.js' },
    { path: 'register.html', needsEnv: true, needsApp: false, envPath: './assets/js/env-config.js' }
];

files.forEach(file => {
    const filePath = path.join(__dirname, file.path);
    console.log(`Processing: ${file.path}`);
    
    try {
        let content = fs.readFileSync(filePath, 'utf8');
        
        let originalLength = content.length;
        
        content = content.replace(/http:\/\/localhost:8080/g, '');
        
        if (content.length !== originalLength) {
            console.log(`  Replaced hardcoded URLs`);
        }
        
        if (file.needsEnv) {
            if (!content.includes(file.envPath)) {
                const headTag = '<head>';
                const envScript = `<head>\n    <script src="${file.envPath}"></script>`;
                content = content.replace(headTag, envScript);
                console.log(`  Added env-config.js`);
            }
        }
        
        if (file.needsApp) {
            const authJsPath = file.path.includes('modules') ? '../../assets/js/auth.js' : './assets/js/auth.js';
            if (!content.includes(file.appPath)) {
                const authScriptTag = `<script src="${authJsPath}"></script>`;
                const replacement = `<script src="${authJsPath}"></script>\n    <script src="${file.appPath}"></script>`;
                content = content.replace(authScriptTag, replacement);
                console.log(`  Added app.js`);
            }
        }
        
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`  Saved: ${file.path}`);
    } catch (error) {
        console.error(`Error processing ${file.path}:`, error.message);
    }
});

console.log('\nDone! All files processed successfully.');

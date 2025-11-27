const fs = require('fs');
const path = require('path');

const sourceDir = path.join(__dirname, '../public');
const destDir = path.join(__dirname, 'src/templates');

if (!fs.existsSync(destDir)){
    fs.mkdirSync(destDir, { recursive: true });
}

const filesToCopy = [
    'onboarding-email-1-first-workout.html',
    'onboarding-email-2-ai-coach.html',
    'onboarding-email-3-progress-tracking.html',
    'onboarding-email-4-advanced-features.html',
    're-engagement-email-gmail.html'
];

filesToCopy.forEach(file => {
    const srcPath = path.join(sourceDir, file);
    const destPath = path.join(destDir, file);
    
    if (fs.existsSync(srcPath)) {
        // Read file and convert to TypeScript export
        const content = fs.readFileSync(srcPath, 'utf8');
        // We escape backticks to avoid breaking the template string
        const escapedContent = content.replace(/`/g, '\\`'); 
        
        // Create a variable name from the filename
        const varName = file.replace(/-([a-z])/g, (g) => g[1].toUpperCase()).replace('.html', '').replace('onboardingEmail', 'email');
        
        // We will just copy the raw HTML for now, but reading it in the function is tricky if we don't compile it.
        // Actually, the easiest way to bundle this into the build is to turn it into a TS file.
        
        // STRATEGY: Create a templates.ts file that exports these strings.
    }
});

// BETTER STRATEGY:
// Let's generate a single `src/generated-templates.ts` file that exports all the HTML strings.
// This guarantees they are compiled into the JS bundle.

let tsContent = '// This file is auto-generated. Do not edit directly.\n\n';

filesToCopy.forEach(file => {
    const srcPath = path.join(sourceDir, file);
    if (fs.existsSync(srcPath)) {
        const content = fs.readFileSync(srcPath, 'utf8');
        const mapKey = file.includes('email-1') ? 'day1' :
                       file.includes('email-2') ? 'day3' :
                       file.includes('email-3') ? 'day7' :
                       file.includes('email-4') ? 'day14' :
                       file.includes('re-engagement') ? 'reEngagement' : 'unknown';

        tsContent += `export const ${mapKey} = \`${content.replace(/`/g, '\\`').replace(/\$\{/g, '\\${')}\`;\n\n`;
    }
});

fs.writeFileSync(path.join(__dirname, 'src/generated-templates.ts'), tsContent);
console.log('Email templates compiled to src/generated-templates.ts');

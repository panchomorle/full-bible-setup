const fs = require('fs');
const path = require('path');

const SOURCE_DIR = __dirname;
const TARGET_DIR = 'C:/Users/eljua/Documents/UAP/.obsidian/plugins/local-bible-ref';

const ARTIFACTS = ['main.js', 'manifest.json', 'styles.css'];

console.log('Syncing production plugin bundle to Obsidian vault...');
console.log(`Source: ${SOURCE_DIR}`);
console.log(`Target: ${TARGET_DIR}\n`);

if (!fs.existsSync(TARGET_DIR)) {
	fs.mkdirSync(TARGET_DIR, { recursive: true });
}

for (const file of ARTIFACTS) {
	const srcPath = path.join(SOURCE_DIR, file);
	const destPath = path.join(TARGET_DIR, file);

	if (!fs.existsSync(srcPath)) {
		console.error(`ERROR: Source artifact not found: ${srcPath}`);
		process.exit(1);
	}

	const content = fs.readFileSync(srcPath);
	fs.writeFileSync(destPath, content);
	const stat = fs.statSync(destPath);
	console.log(`✔ Synced ${file} (${stat.size} bytes) -> ${destPath}`);
}

console.log('\nAll production bundle artifacts synced successfully to vault!');

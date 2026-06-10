// scripts/create-upload-zip.js
// Creates a clean zip for Hostinger upload using a PowerShell-backed zip step
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const outputZip = path.join(projectRoot, 'lokswami-upload.zip');

// Dirs to exclude (relative names)
const excludeDirs = new Set([
  'node_modules', '.next', '.next-dev', '.git', '.idea', '.vscode',
  '.codex-run', '.codex-tmp', '.hostinger', 'storage',
  '.env-test-escaped', '.env-test-single', '__upload_staging',
  '.gemini'
]);

// Files to exclude
const excludeFilePatterns = [
  /^\.env$/,
  /^\.env\.local$/,
  /^\.env\.hostinger$/,
  /^\.env\.production$/,
  /^\.env\.test$/,
  /\.log$/,
  /\.tsbuildinfo$/,
  /^source-code\.zip$/,
  /^lokswami-upload\.zip$/,
  /^lokswami-hostinger-upload/,
];

function shouldExcludeFile(name) {
  return excludeFilePatterns.some(p => p.test(name));
}

function collectFiles(dir, baseDir, results = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (excludeDirs.has(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectFiles(fullPath, baseDir, results);
    } else if (entry.isFile()) {
      if (shouldExcludeFile(entry.name)) continue;
      const relPath = path.relative(baseDir, fullPath);
      results.push({ fullPath, relPath });
    }
  }
  return results;
}

console.log('Collecting files...');
const files = collectFiles(projectRoot, projectRoot);
console.log(`Found ${files.length} files to include`);

// Use tar to create zip since we need a proper zip format
// Windows has tar built-in that supports zip format
if (fs.existsSync(outputZip)) fs.unlinkSync(outputZip);

// Write file list to a temp file to avoid command line length limits
const listFile = path.join(projectRoot, '__zip_filelist.txt');
fs.writeFileSync(listFile, files.map(f => f.relPath).join('\n'));

console.log('Creating zip...');
try {
  // Use PowerShell .NET to create zip properly
  const script = `
Add-Type -Assembly "System.IO.Compression.FileSystem"
Add-Type -Assembly "System.IO.Compression"
$zip = [System.IO.Compression.ZipFile]::Open("${outputZip.replace(/\\/g, '\\\\')}", [System.IO.Compression.ZipArchiveMode]::Create)
$root = "${projectRoot.replace(/\\/g, '\\\\')}"
$list = Get-Content "${listFile.replace(/\\/g, '\\\\')}"
$count = 0
foreach ($rel in $list) {
  $full = Join-Path $root $rel
  if (Test-Path $full -PathType Leaf) {
    $entryName = $rel -replace '\\\\','/'
    [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $full, $entryName, [System.IO.Compression.CompressionLevel]::Optimal) | Out-Null
    $count++
  }
}
$zip.Dispose()
Write-Host "Added $count files to zip"
`;
  const psFile = path.join(projectRoot, '__create_zip.ps1');
  fs.writeFileSync(psFile, script);
  const shellCommand = process.platform === 'win32' ? 'powershell' : 'pwsh';
  const shellArgs =
    process.platform === 'win32'
      ? `-ExecutionPolicy Bypass -File "${psFile}"`
      : `-File "${psFile}"`;
  const result = execSync(`${shellCommand} ${shellArgs}`, {
    encoding: 'utf8', 
    maxBuffer: 50 * 1024 * 1024,
    timeout: 300000 
  });
  console.log(result.trim());
  
  // Cleanup temp files
  fs.unlinkSync(listFile);
  fs.unlinkSync(psFile);
} catch (err) {
  console.error('Zip creation failed:', err.message);
  process.exit(1);
}

// Verify
if (fs.existsSync(outputZip)) {
  const stats = fs.statSync(outputZip);
  const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
  console.log(`\n=== SUCCESS ===`);
  console.log(`Zip: ${outputZip}`);
  console.log(`Size: ${sizeMB} MB`);
} else {
  console.error('ERROR: Zip file was not created');
  process.exit(1);
}

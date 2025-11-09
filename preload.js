const path = require('path');

// Load StorageManager using Node.js module resolution
// This works correctly in both dev and production
const StorageManager = require(path.join(__dirname, 'src', 'storage.js'));

// Make it available globally so app.js can access it
window.StorageManager = StorageManager;

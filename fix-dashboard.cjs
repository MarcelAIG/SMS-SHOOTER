const fs = require('fs');
let code = fs.readFileSync('src/pages/Dashboard.tsx', 'utf8');

code = code.replace(/updateCampaignStatus\(c\.id, 'RUNNING'\)\} /g, `updateCampaignStatus(c.id, 'RUNNING'); }} `);
code = code.replace(/updateCampaignStatus\(c\.id, 'PAUSED'\)\} /g, `updateCampaignStatus(c.id, 'PAUSED'); }} `);
code = code.replace(/updateCampaignStatus\(c\.id, 'STOPPED'\)\} /g, `updateCampaignStatus(c.id, 'STOPPED'); }} `);
code = code.replace(/updateCampaignStatus\(c\.id, 'CANCELLED'\)\} /g, `updateCampaignStatus(c.id, 'CANCELLED'); }} `);

fs.writeFileSync('src/pages/Dashboard.tsx', code);

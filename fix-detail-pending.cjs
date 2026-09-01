const fs = require('fs');
let code = fs.readFileSync('src/pages/CampaignDetail.tsx', 'utf8');

code = code.replace(
  "{campaign.status === 'RUNNING' && stats.queued > 0 ? 'Pending' : 'N/A'}",
  "{campaign.status === 'RUNNING' && stats.queued > 0 ? (campaign.sendWindowStart ? 'Pending (Waiting for Send Window or Rate Limit)' : 'Pending') : 'N/A'}"
);

fs.writeFileSync('src/pages/CampaignDetail.tsx', code);

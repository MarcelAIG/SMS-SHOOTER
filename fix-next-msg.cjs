const fs = require('fs');
let code = fs.readFileSync('src/pages/CampaignDetail.tsx', 'utf8');

code = code.replace(
`            <div>
              <div className="text-neutral-500 mb-1">Status</div>
              <div className="text-white font-medium">{campaign.status}</div>
            </div>
            <div>
              <div className="text-neutral-500 mb-1">Estimated completion</div>`,
`            <div>
              <div className="text-neutral-500 mb-1">Status</div>
              <div className="text-white font-medium">{campaign.status}</div>
            </div>
            <div>
              <div className="text-neutral-500 mb-1">Next message</div>
              <div className="text-white font-medium">
                {campaign.status === 'RUNNING' && stats.queued > 0 ? 'Pending' : 'N/A'}
              </div>
            </div>
            <div>
              <div className="text-neutral-500 mb-1">Estimated completion</div>`
);

fs.writeFileSync('src/pages/CampaignDetail.tsx', code);

const fs = require('fs');
let code = fs.readFileSync('src/pages/Dashboard.tsx', 'utf8');

code = code.replace(
  "const updateCampaignStatus = async (id: string, status: string) => {",
  `const updateCampaignStatus = async (id: string, status: string, currentStart?: number) => {`
);

code = code.replace(
  "await updateDoc(doc(db, 'campaigns', id), { status });",
  `if (status === 'RUNNING' && currentStart && Date.now() < currentStart) {
      await updateDoc(doc(db, 'campaigns', id), { status, scheduledStart: Date.now() });
    } else {
      await updateDoc(doc(db, 'campaigns', id), { status });
    }`
);

code = code.replace(
  /updateCampaignStatus\(c\.id, 'RUNNING'\); \}\} /g,
  `updateCampaignStatus(c.id, 'RUNNING', c.scheduledStart); }} `
);

fs.writeFileSync('src/pages/Dashboard.tsx', code);

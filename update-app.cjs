const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

code = code.replace("import Campaign from './pages/Campaign';", "import Campaign from './pages/Campaign';\nimport CampaignDetail from './pages/CampaignDetail';");
code = code.replace('<Route path="/campaign" element={<Campaign />} />', '<Route path="/campaign" element={<Campaign />} />\n            <Route path="/campaign/:id" element={<CampaignDetail />} />');

fs.writeFileSync('src/App.tsx', code);

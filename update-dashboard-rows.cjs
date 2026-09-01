const fs = require('fs');
let code = fs.readFileSync('src/pages/Dashboard.tsx', 'utf8');

if (!code.includes('import { useNavigate }')) {
  code = code.replace("import { Play, Pause, Square, XCircle } from 'lucide-react';", "import { Play, Pause, Square, XCircle } from 'lucide-react';\nimport { useNavigate } from 'react-router-dom';");
}

if (!code.includes('const navigate = useNavigate();')) {
  code = code.replace("export default function Dashboard() {", "export default function Dashboard() {\n  const navigate = useNavigate();");
}

code = code.replace(/<tr key=\{c\.id\} className="hover:bg-neutral-800\/30">/g, `<tr key={c.id} className="hover:bg-neutral-800/30 cursor-pointer" onClick={() => navigate(\`/campaign/\${c.id}\`)}>`);

code = code.replace(/onClick=\{\(\) => updateCampaignStatus\(c\.id, /g, `onClick={(e) => { e.stopPropagation(); updateCampaignStatus(c.id, `);

fs.writeFileSync('src/pages/Dashboard.tsx', code);

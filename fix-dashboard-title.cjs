const fs = require('fs');
let code = fs.readFileSync('src/pages/Dashboard.tsx', 'utf8');

code = code.replace(
  '<h2 className="text-xl font-bold text-white mb-4">Dashboard</h2>',
  '<h2 className="text-xl font-bold text-white mb-4 flex items-center space-x-2"><span>Dashboard</span><span className="bg-blue-600/20 text-blue-400 text-[10px] px-2 py-0.5 rounded font-mono border border-blue-500/30">v2 Updated</span></h2>'
);

fs.writeFileSync('src/pages/Dashboard.tsx', code);

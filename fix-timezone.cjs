const fs = require('fs');
let code = fs.readFileSync('src/pages/Campaign.tsx', 'utf8');

code = code.replace(
  "const [timezone, setTimezone] = useState('Europe/Oslo');",
  "const [timezone, setTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York');"
);

code = code.replace(
  '<option value="America/New_York">America/New_York</option>',
  '<option value="America/New_York">America/New_York</option>\n                  <option value={Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Los_Angeles"}>Current Local Timezone</option>'
);

fs.writeFileSync('src/pages/Campaign.tsx', code);

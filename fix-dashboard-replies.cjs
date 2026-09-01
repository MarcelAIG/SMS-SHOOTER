const fs = require('fs');
let code = fs.readFileSync('src/pages/Dashboard.tsx', 'utf8');

code = code.replace(
  '<th className="px-4 py-2 font-medium">Remain</th>',
  '<th className="px-4 py-2 font-medium">Remain</th>\n                      <th className="px-4 py-2 font-medium">Replies</th>'
);

code = code.replace(
  '<td className="px-4 py-2">{cStat.remaining}</td>',
  '<td className="px-4 py-2">{cStat.remaining}</td>\n                          <td className="px-4 py-2">{cStat.replies}</td>'
);

code = code.replace(
  'statsObj[camp.id] = { sent, remaining, failed, replies, total: rcpts.size };',
  `const msgs = await getDocs(query(collection(db, 'messages'), where('direction', '==', 'INBOUND')));
        let campReplies = 0;
        rcpts.forEach(r => {
           const matches = msgs.docs.filter(d => d.data().contactId === r.data().contactId);
           if (matches.length > 0) campReplies++;
        });
        statsObj[camp.id] = { sent, remaining, failed, replies: campReplies, total: rcpts.size };`
);

fs.writeFileSync('src/pages/Dashboard.tsx', code);

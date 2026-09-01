import { readFileSync } from 'fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const serviceAccount = JSON.parse(readFileSync('./service-account.json', 'utf8'));

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

async function run() {
  const snapshot = await db.collection('messages').where('direction', '==', 'INBOUND').get();
  snapshot.forEach(doc => {
    console.log(doc.id, 'read:', doc.data().read);
  });
}
run();

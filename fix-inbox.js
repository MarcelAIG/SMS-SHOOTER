import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, doc, updateDoc, query, where } from "firebase/firestore";

const app = initializeApp({
  projectId: "crm-ai-7c371",
});
const db = getFirestore(app);

async function run() {
  const msgs = await getDocs(query(collection(db, "messages"), where("direction", "==", "INBOUND")));
  const contactIds = new Set();
  msgs.forEach(m => contactIds.add(m.data().contactId));
  
  for (const cid of contactIds) {
    try {
      await updateDoc(doc(db, "contacts", cid), { hasReplied: true });
      console.log("Updated", cid);
    } catch(e) {}
  }
  console.log("Done");
}
run();

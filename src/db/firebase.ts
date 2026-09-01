import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  projectId: "project-2a2bb2cf-74dc-4709-934",
  appId: "1:260006343471:web:05e0fc9e7199add57ba7da",
  apiKey: "AIzaSyDjPULd98MAqZVPNy-myX18gkzR35IG2yo",
  authDomain: "project-2a2bb2cf-74dc-4709-934.firebaseapp.com",
  storageBucket: "project-2a2bb2cf-74dc-4709-934.firebasestorage.app",
  messagingSenderId: "260006343471"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, "ai-studio-smsshooter-9600a3a4-7c5a-4d4a-964f-04c047c7606e");

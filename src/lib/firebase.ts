import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Provider Google standard per il login (nessun ambito sensibile richiesto, aperto a tutti)
export const googleProvider = new GoogleAuthProvider();

// Provider dedicato per Google Drive Backup (richiede ambito drive.file solo on-demand)
export const googleDriveProvider = new GoogleAuthProvider();
googleDriveProvider.addScope('https://www.googleapis.com/auth/drive.file');

export const db = (firebaseConfig as any).firestoreDatabaseId 
    ? getFirestore(app, (firebaseConfig as any).firestoreDatabaseId) 
    : getFirestore(app);


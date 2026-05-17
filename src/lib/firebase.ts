import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
    apiKey: "AIzaSyCukx7kWJGon27eC97A9juQ5U6lP-MIbQk",
    authDomain: "looksmax-clash.firebaseapp.com",
    projectId: "looksmax-clash",
    storageBucket: "looksmax-clash.firebasestorage.app",
    messagingSenderId: "345795660911",
    appId: "1:345795660911:web:3586118407c51ad462119a",
    measurementId: "G-T5QB4QM1WS"
};

// Initialize Firebase
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const auth = getAuth(app);
const db = getFirestore(app);

export { auth, db };

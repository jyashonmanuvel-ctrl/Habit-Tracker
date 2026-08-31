/* ===================== firebase-config.js =====================
   Paste YOUR Firebase project's config below (see setup steps).
   This file is safe to make public — these are client identifiers,
   not secrets. Access is protected by Firestore security rules.
================================================================= */

const firebaseConfig = {
  apiKey: "AIzaSyCaAh8u2kdUez1Di8taP77D3JIxvh3Nwlc",
  authDomain: "habit-tracker-20625.firebaseapp.com",
  projectId: "habit-tracker-20625",
  storageBucket: "habit-tracker-20625.firebasestorage.app",
  messagingSenderId: "962292978266",
  appId: "1:962292978266:web:30f03d598c8085fcfe7e63",
  measurementId: "G-VXX68JXP7Q"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

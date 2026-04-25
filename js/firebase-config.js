// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAijP8Q_C-0wBmpUrtiPjPi5Ob6aRmLmU4",
  authDomain: "flashforge-3d2f6.firebaseapp.com",
  projectId: "flashforge-3d2f6",
  storageBucket: "flashforge-3d2f6.firebasestorage.app",
  messagingSenderId: "560445625415",
  appId: "1:560445625415:web:869a060bf70150c6444d62",
  measurementId: "G-T1SEZRYKKQ"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
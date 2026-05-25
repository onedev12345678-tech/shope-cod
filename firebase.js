// firebase.js

const firebaseConfig = {
  apiKey: "AIzaSyC3_Mu644DfvIvRk-uw4UGmXEnjvSgpd1s",
  authDomain: "coba-70608.firebaseapp.com",
  databaseURL: "https://coba-70608-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "coba-70608",
  storageBucket: "coba-70608.firebasestorage.app",
  messagingSenderId: "54930111072",
  appId: "1:54930111072:web:c09e6cd6e4e0177ce46105",
  measurementId: "G-NJXNLLDL3H"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.database();
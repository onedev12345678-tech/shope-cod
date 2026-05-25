// Firebase Configuration (sama)
const firebaseConfig = {
    apiKey: "AIzaSyC3_Mu644DfvIvRk-uw4UGmXEnjvSgpd1s",
  authDomain: "coba-70608.firebaseapp.com",
  projectId: "coba-70608",
  storageBucket: "https://coba-70608.firebasestorage.app",
  messagingSenderId: "54930111072",
  appId: "1:54930111072:web:c09e6cd6e4e0177ce46105",
  measurementId: "G-NJXNLLDL3H"
};

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const db = firebase.database();

// Fungsi untuk pembeli login & lihat datanya sendiri
function getDataPembeli() {
    const uid = firebase.auth().currentUser.uid;
    return db.ref(`reseller/pembeli_list/${uid}`).once('value');
}

// Fungsi untuk pembeli update profil
function updateProfilPembeli(data) {
    const uid = firebase.auth().currentUser.uid;
    return db.ref(`reseller/pembeli_list/${uid}`).update(data);
}
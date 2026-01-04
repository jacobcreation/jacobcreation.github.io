// firebase-messaging-sw.js

// Load Firebase scripts
importScripts('https://www.gstatic.com/firebasejs/9.6.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.6.1/firebase-messaging-compat.js');

// Initialize Firebase
firebase.initializeApp({
  apiKey: "AIzaSyDw611ny0fT5UMFfVnlW_4-RzABPgNTmH8",
  authDomain: "reminder-app-fb072.firebaseapp.com",
  projectId: "reminder-app-fb072",
  storageBucket: "reminder-app-fb072.appspot.com",
  messagingSenderId: "280281930384",
  appId: "1:280281930384:web:81167b17c17e0f17cc5615",
  measurementId: "G-F6LZJPSQKW"
});

// Get messaging instance
const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log('📩 Background message received:', payload);

  const notificationTitle = payload.notification.title || "Reminder";
  const notificationOptions = {
    body: payload.notification.body || "You have an appointment.",
    icon: '/icon.png'
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

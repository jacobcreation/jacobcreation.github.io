const admin = require("firebase-admin");

// Load the service account key you uploaded
const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

// Replace this with the token you got from Enable Notifications
const registrationTokens = [
  "YOUR-FCM-TOKEN-HERE"
];

const message = {
  notification: {
    title: "⏰ Reminder",
    body: "This is your first test push!"
  },
  tokens: registrationTokens
};

admin.messaging().sendMulticast(message)
  .then((response) => {
    console.log("✅ Successfully sent:", response);
  })
  .catch((error) => {
    console.error("❌ Error sending message:", error);
  });

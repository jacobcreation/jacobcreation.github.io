const { GoogleAuth } = require("google-auth-library");
const fetch = require("node-fetch");

// Load your service account JSON
const key = require("D:/Jacobs Stuff/firebase-key.json");

// Normalize the private key (turn \\n into real newlines)
key.private_key = key.private_key.replace(/\\n/g, '\n');

// Create GoogleAuth instance with your credentials
const auth = new GoogleAuth({
  credentials: key,
  scopes: ["https://www.googleapis.com/auth/firebase.messaging"]
});

async function sendPush() {
  try {
    // Get an authorized client
    const client = await auth.getClient();

    // Get an access token
    const accessToken = await client.getAccessToken();
    console.log("✅ Access token acquired!");

    // Replace with your actual FCM device token
    const deviceToken = "YOUR_FCM_DEVICE_TOKEN";

    // Send push notification
    const res = await fetch("https://fcm.googleapis.com/v1/projects/reminder-app-fb072/messages:send", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + accessToken.token,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        message: {
          token: deviceToken,
          notification: {
            title: "⏰ Appointment Reminder",
            body: "It’s time for your meeting!"
          }
        }
      })
    });

    const data = await res.json();
    console.log("📨 FCM response:", data);
  } catch (err) {
    console.error("❌ Push error:", err);
  }
}

sendPush();

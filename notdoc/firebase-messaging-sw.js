const { GoogleAuth } = require("google-auth-library");
const fetch = require("node-fetch");
const cron = require("node-cron");

// Load your service account JSON
const key = require("D:/Jacobs Stuff/firebase-key.json");

// Normalize the private key
key.private_key = key.private_key.replace(/\\n/g, '\n');

// Create GoogleAuth instance
const auth = new GoogleAuth({
  credentials: key,
  scopes: ["https://www.googleapis.com/auth/firebase.messaging"]
});

// Function to send a push notification
async function sendPush(token, title, body) {
  try {
    const client = await auth.getClient();
    const accessToken = await client.getAccessToken();

    const res = await fetch("https://fcm.googleapis.com/v1/projects/reminder-app-fb072/messages:send", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + accessToken.token,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        message: {
          token: token,
          notification: {
            title: title,
            body: body
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

// Example appointment list
// Cron format: "minute hour day month weekday"
// e.g. "0 9 * * *" = every day at 9:00 AM
const appointments = [
  {
    time: "0 9 * * *", // every day at 9:00 AM
    token: "PASTE_REAL_FCM_TOKEN_HERE",
    title: "⏰ Morning Appointment",
    body: "Your 9 AM appointment is starting."
  },
  {
    time: "30 14 * * *", // every day at 2:30 PM
    token: "PASTE_REAL_FCM_TOKEN_HERE",
    title: "🩺 Afternoon Appointment",
    body: "Your 2:30 PM appointment is starting."
  }
];

// Schedule each appointment
appointments.forEach(appt => {
  cron.schedule(appt.time, () => {
    console.log("🔔 Sending reminder:", appt.title);
    sendPush(appt.token, appt.title, appt.body);
  });
});

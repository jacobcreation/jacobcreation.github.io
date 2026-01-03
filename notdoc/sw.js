self.addEventListener('install', event => {
  console.log('Service Worker installed');
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  console.log('Service Worker activated');
});

// Listen for push events
self.addEventListener('push', event => {
  const data = event.data ? event.data.text() : 'Reminder!';
  event.waitUntil(
    self.registration.showNotification('⏰ Appointment Reminder', {
      body: data
    })
  );
});

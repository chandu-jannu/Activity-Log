importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyDzAmbek5O3CKprzUyYReqcwCV3ZUYcnno",
  authDomain: "activity-log-dd60a.firebaseapp.com",
  projectId: "activity-log-dd60a",
  storageBucket: "activity-log-dd60a.firebasestorage.app",
  messagingSenderId: "24479717136",
  appId: "1:24479717136:web:c10a7f9a773432b1837795"
});

const messaging = firebase.messaging();

// Handle background messages (when tab is closed/hidden)
messaging.onBackgroundMessage(function(payload) {
  console.log('Background message received:', payload);

  const notificationTitle = payload.notification.title || '📋 Activity Log';
  const notificationOptions = {
    body: payload.notification.body || 'You have pending tasks!',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: 'activity-log-notification',
    renotify: true,
    data: payload.data
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click
self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url.includes('activity-log') && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});

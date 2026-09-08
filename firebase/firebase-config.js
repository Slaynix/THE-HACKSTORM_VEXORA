// Firebase CLIENT-SIDE configuration
// Values are injected at runtime from the server's /api/config endpoint
// or from a build-time env replacement. Never hardcode real secrets here.

// ⚠️  This file is a TEMPLATE. The actual values come from environment variables.
//     See .env.example for the required keys.

const firebaseConfig = {
  apiKey:            '__FIREBASE_API_KEY__',
  authDomain:        '__FIREBASE_AUTH_DOMAIN__',
  projectId:         '__FIREBASE_PROJECT_ID__',
  storageBucket:     '__FIREBASE_PROJECT_ID__.appspot.com',
  messagingSenderId: '__FIREBASE_MESSAGING_SENDER_ID__',
  appId:             '__FIREBASE_APP_ID__',
};

export default firebaseConfig;

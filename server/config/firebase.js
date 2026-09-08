'use strict';

const admin = require('firebase-admin');
require('dotenv').config();

let _app = null;
let _firestore = null;

// ── In-Memory Firestore Driver (Fallback when service account is not provided) ──
function createInMemoryFirestore() {
  const store = require('../data/store');

  class DocumentSnapshot {
    constructor(ref, data) {
      this.ref = ref;
      this.id = ref.id;
      this._data = data;
      this.exists = data !== null && data !== undefined;
    }
    data() {
      return this._data ? JSON.parse(JSON.stringify(this._data)) : undefined;
    }
  }

  class QuerySnapshot {
    constructor(docs) {
      this.docs = docs;
      this.size = docs.length;
      this.empty = docs.length === 0;
    }
    forEach(callback) {
      this.docs.forEach(callback);
    }
  }

  class DocumentReference {
    constructor(collectionName, id) {
      this.collectionName = collectionName;
      this.id = id;
    }

    async get() {
      const data = store.findById(this.collectionName, this.id);
      return new DocumentSnapshot(this, data);
    }

    async set(data, options = {}) {
      const existing = store.findById(this.collectionName, this.id);
      if (existing && options.merge) {
        store.update(this.collectionName, this.id, data);
      } else {
        const list = store.get(this.collectionName);
        const idx = list.findIndex(doc => doc.id === this.id);
        const now = new Date().toISOString();
        const doc = {
          ...data,
          id: this.id,
          createdAt: existing ? existing.createdAt : (data.createdAt || now),
          updatedAt: now,
        };
        if (idx !== -1) list[idx] = doc;
        else list.unshift(doc);
      }
      return { writeTime: new Date() };
    }

    async update(data) {
      const updated = store.update(this.collectionName, this.id, data);
      if (!updated) {
        const err = new Error(`Document ${this.id} not found`);
        err.code = 5; // NOT_FOUND
        throw err;
      }
      return { writeTime: new Date() };
    }

    async delete() {
      store.delete(this.collectionName, this.id);
      return { writeTime: new Date() };
    }
  }

  class Query {
    constructor(collectionName, filters = [], orderBys = [], limitVal = null) {
      this.collectionName = collectionName;
      this.filters = filters;
      this.orderBys = orderBys;
      this.limitVal = limitVal;
    }

    where(field, op, val) {
      return new Query(
        this.collectionName,
        [...this.filters, { field, op, val }],
        this.orderBys,
        this.limitVal
      );
    }

    orderBy(field, direction = 'asc') {
      return new Query(
        this.collectionName,
        this.filters,
        [...this.orderBys, { field, direction }],
        this.limitVal
      );
    }

    limit(n) {
      return new Query(this.collectionName, this.filters, this.orderBys, n);
    }

    async get() {
      let list = store.get(this.collectionName);

      // Apply where filters
      for (const { field, op, val } of this.filters) {
        list = list.filter(doc => {
          if (op === '==' || op === '===') return doc[field] === val;
          if (op === '>') return doc[field] > val;
          if (op === '>=') return doc[field] >= val;
          if (op === '<') return doc[field] < val;
          if (op === '<=') return doc[field] <= val;
          if (op === '!=') return doc[field] !== val;
          return true;
        });
      }

      // Apply order by
      if (this.orderBys.length > 0) {
        const { field, direction } = this.orderBys[0];
        list = [...list].sort((a, b) => {
          if (a[field] < b[field]) return direction === 'desc' ? 1 : -1;
          if (a[field] > b[field]) return direction === 'desc' ? -1 : 1;
          return 0;
        });
      }

      // Apply limit
      if (this.limitVal !== null) {
        list = list.slice(0, this.limitVal);
      }

      const docSnapshots = list.map(
        data => new DocumentSnapshot(new DocumentReference(this.collectionName, data.id), data)
      );
      return new QuerySnapshot(docSnapshots);
    }
  }

  class CollectionReference extends Query {
    constructor(collectionName) {
      super(collectionName);
    }

    doc(id) {
      const docId = id || `${this.collectionName.slice(0, 4)}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      return new DocumentReference(this.collectionName, docId);
    }

    async add(data) {
      const ref = this.doc();
      await ref.set(data);
      return ref;
    }
  }

  class WriteBatch {
    constructor() {
      this.ops = [];
    }
    set(ref, data, options) {
      this.ops.push(() => ref.set(data, options));
      return this;
    }
    update(ref, data) {
      this.ops.push(() => ref.update(data));
      return this;
    }
    delete(ref) {
      this.ops.push(() => ref.delete());
      return this;
    }
    async commit() {
      for (const op of this.ops) {
        await op();
      }
      return [];
    }
  }

  return {
    collection(name) {
      return new CollectionReference(name);
    },
    batch() {
      return new WriteBatch();
    },
    async runTransaction(updateFn) {
      const transaction = {
        async get(ref) {
          return ref.get();
        },
        set(ref, data, options) {
          return ref.set(data, options);
        },
        update(ref, data) {
          return ref.update(data);
        },
        delete(ref) {
          return ref.delete();
        },
      };
      return updateFn(transaction);
    },
  };
}

/**
 * Initialises Firebase Admin SDK once and returns the admin instance.
 */
function getFirebaseAdmin() {
  if (_app) return admin;

  const { FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY } = process.env;

  if (FIREBASE_PROJECT_ID && FIREBASE_CLIENT_EMAIL && FIREBASE_PRIVATE_KEY) {
    try {
      _app = admin.initializeApp({
        credential: admin.credential.cert({
          projectId:   FIREBASE_PROJECT_ID,
          clientEmail: FIREBASE_CLIENT_EMAIL,
          privateKey:  FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        }),
      });
      console.log(`[firebase config] Firebase Admin initialized for: ${FIREBASE_PROJECT_ID}`);
      return admin;
    } catch (err) {
      console.warn('[firebase config] Service account initialization error, using emulator/stub:', err.message);
    }
  }

  // Fallback / emulator initialization
  if (admin.apps.length > 0) {
    _app = admin.apps[0];
  } else {
    _app = admin.initializeApp({ projectId: FIREBASE_PROJECT_ID || 'sanchay-plus-dev' });
  }
  return admin;
}

/**
 * Returns the Firestore instance (Cloud Firestore or In-Memory driver).
 */
function getFirestore() {
  if (_firestore) return _firestore;

  const { FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY } = process.env;
  const hasCredentials = !!(FIREBASE_PROJECT_ID && FIREBASE_CLIENT_EMAIL && FIREBASE_PRIVATE_KEY);
  const hasEmulator = !!process.env.FIRESTORE_EMULATOR_HOST;

  if (hasCredentials || hasEmulator) {
    try {
      _firestore = getFirebaseAdmin().firestore();
      return _firestore;
    } catch (err) {
      console.warn('[firebase config] Firestore connection error, falling back to in-memory store:', err.message);
    }
  }

  // In-memory Firestore driver (guarantees standard Firestore SDK API)
  _firestore = createInMemoryFirestore();
  return _firestore;
}

module.exports = { getFirebaseAdmin, getFirestore };

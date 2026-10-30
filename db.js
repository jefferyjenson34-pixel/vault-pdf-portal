/**
 * Vault PDF Portal - MongoDB Atlas Persistence Layer
 * 
 * Provides transparent, permanent cloud persistence for user accounts,
 * sessions, documents metadata, reports, settings, and contacts.
 * 
 * Solves Render's ephemeral filesystem issue where accounts disappeared
 * upon redeployment or cold restarts.
 */

const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

const MONGODB_URI = process.env.MONGODB_URI ||
  'mongodb+srv://jefferyjenson34_db_user:t0S2ZSrrrpkcUTrK@mongoose.lifcamf.mongodb.net/vault_pdf_portal?retryWrites=true&w=majority';

// ─── Mongoose Schemas (with id: false to preserve custom 'id' string field) ──
const userSchema = new mongoose.Schema({
  id: { type: String, required: true, index: true },
  email: { type: String, required: true, index: true }
}, { id: false, strict: false, timestamps: true });

const sessionSchema = new mongoose.Schema({
  token: { type: String, required: true, index: true, unique: true }
}, { id: false, strict: false, timestamps: true });

const documentSchema = new mongoose.Schema({
  id: { type: String, required: true, index: true },
  userId: { type: String, required: true, index: true }
}, { id: false, strict: false, timestamps: true });

const sharedLinkSchema = new mongoose.Schema({
  token: { type: String, required: true, index: true, unique: true }
}, { id: false, strict: false, timestamps: true });

const reportSchema = new mongoose.Schema({
  id: { type: String, required: true }
}, { id: false, strict: false, timestamps: true });

const contactSchema = new mongoose.Schema({
  id: { type: String }
}, { id: false, strict: false, timestamps: true });

const visitorSchema = new mongoose.Schema({
  ip: { type: String },
  timestamp: { type: String }
}, { id: false, strict: false, timestamps: true });

const appConfigSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true, index: true },
  value: { type: mongoose.Schema.Types.Mixed }
}, { id: false, strict: false, timestamps: true });

// ─── Models ──────────────────────────────────────────────────────────
const UserModel = mongoose.models.User || mongoose.model('User', userSchema, 'users');
const SessionModel = mongoose.models.UserSession || mongoose.model('UserSession', sessionSchema, 'user_sessions');
const DocumentModel = mongoose.models.UserDocument || mongoose.model('UserDocument', documentSchema, 'user_documents');
const SharedLinkModel = mongoose.models.SharedLink || mongoose.model('SharedLink', sharedLinkSchema, 'shared_links');
const ReportModel = mongoose.models.Report || mongoose.model('Report', reportSchema, 'reports');
const ContactModel = mongoose.models.Contact || mongoose.model('Contact', contactSchema, 'contacts');
const VisitorModel = mongoose.models.Visitor || mongoose.model('Visitor', visitorSchema, 'visitors');
const AppConfigModel = mongoose.models.AppConfig || mongoose.model('AppConfig', appConfigSchema, 'app_configs');

// In-memory synchronized store for zero-latency synchronous reads
const cache = {
  users: null,
  userSessions: null,
  userDocuments: null,
  sharedLinks: null,
  reports: null,
  contacts: null,
  visitors: null,
  categories: null,
  downloads: null,
  signingCertificates: null,
  emailConfig: null
};

let filePaths = {};
let seedUser = null;
let defaultEmail = null;
let isConnected = false;

function stripMongo(doc) {
  if (!doc || typeof doc !== 'object') return doc;
  const copy = { ...doc };
  delete copy._id;
  delete copy.__v;
  return copy;
}

/**
 * Connect to MongoDB Atlas and synchronize memory cache with cloud DB.
 */
async function initDatabase(paths, defaultSeedUser, defaultEmailConfig) {
  filePaths = paths || {};
  seedUser = defaultSeedUser;
  defaultEmail = defaultEmailConfig;

  // Setup connection event listeners
  mongoose.connection.on('disconnected', () => {
    isConnected = false;
    console.warn('[MongoDB Atlas] Disconnected. Reconnecting...');
  });
  mongoose.connection.on('reconnected', () => {
    isConnected = true;
    console.log('[MongoDB Atlas] Reconnected successfully.');
  });
  mongoose.connection.on('error', (err) => {
    console.error('[MongoDB Atlas] Error:', err.message);
  });

  try {
    console.log('[MongoDB Atlas] Connecting to cloud cluster...');
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
      retryWrites: true,
      w: 'majority'
    });
    isConnected = true;
    console.log('  🍃 MongoDB Atlas connected: cluster persistent store online.');
  } catch (err) {
    console.warn('  ⚠️  MongoDB Atlas initial connect warning:', err.message);
    console.warn('  ℹ️  Application will run using local filesystem store and retry MongoDB in background.');
  }

  // Synchronize Users
  try {
    if (isConnected) {
      const dbUsers = await UserModel.find({}).lean();
      if (dbUsers && dbUsers.length > 0) {
        cache.users = dbUsers.map(stripMongo);
        console.log(`  👤 Loaded ${cache.users.length} user account(s) from MongoDB Atlas.`);
        try { fs.writeFileSync(filePaths.USERS_FILE, JSON.stringify(cache.users, null, 2)); } catch (_) {}
      } else {
        // Atlas empty, migrate local users to Atlas
        let localUsers = [];
        try { localUsers = JSON.parse(fs.readFileSync(filePaths.USERS_FILE, 'utf-8')); } catch (_) {}
        if (!Array.isArray(localUsers) || localUsers.length === 0) {
          localUsers = seedUser ? [seedUser] : [];
        }
        cache.users = localUsers;
        if (localUsers.length > 0) {
          await UserModel.insertMany(localUsers);
          console.log(`  🚀 Seeded ${localUsers.length} local user(s) into MongoDB Atlas.`);
        }
      }
    }
  } catch (err) {
    console.error('[MongoDB Atlas] Error syncing users:', err.message);
  }

  // Synchronize User Sessions
  try {
    if (isConnected) {
      const dbSessions = await SessionModel.find({}).lean();
      if (dbSessions && dbSessions.length > 0) {
        const sMap = {};
        dbSessions.forEach(s => {
          const doc = stripMongo(s);
          if (doc.token) sMap[doc.token] = doc;
        });
        cache.userSessions = sMap;
        try { fs.writeFileSync(filePaths.USER_SESSIONS_FILE, JSON.stringify(sMap, null, 2)); } catch (_) {}
      } else {
        let localSessions = {};
        try { localSessions = JSON.parse(fs.readFileSync(filePaths.USER_SESSIONS_FILE, 'utf-8')); } catch (_) {}
        cache.userSessions = localSessions || {};
        const sList = Object.entries(cache.userSessions).map(([token, val]) => ({
          token,
          ...(typeof val === 'object' ? val : {})
        }));
        if (sList.length > 0) {
          await SessionModel.insertMany(sList);
        }
      }
    }
  } catch (err) {
    console.error('[MongoDB Atlas] Error syncing sessions:', err.message);
  }

  // Synchronize User Documents metadata
  try {
    if (isConnected) {
      const dbDocs = await DocumentModel.find({}).lean();
      if (dbDocs && dbDocs.length > 0) {
        cache.userDocuments = dbDocs.map(stripMongo);
        try { fs.writeFileSync(filePaths.USER_DOCUMENTS_FILE, JSON.stringify(cache.userDocuments, null, 2)); } catch (_) {}
      } else {
        let localDocs = [];
        try { localDocs = JSON.parse(fs.readFileSync(filePaths.USER_DOCUMENTS_FILE, 'utf-8')); } catch (_) {}
        cache.userDocuments = Array.isArray(localDocs) ? localDocs : [];
        if (cache.userDocuments.length > 0) {
          await DocumentModel.insertMany(cache.userDocuments);
        }
      }
    }
  } catch (err) {
    console.error('[MongoDB Atlas] Error syncing documents metadata:', err.message);
  }

  // Synchronize Shared Links
  try {
    if (isConnected) {
      const dbLinks = await SharedLinkModel.find({}).lean();
      if (dbLinks && dbLinks.length > 0) {
        const lMap = {};
        dbLinks.forEach(l => {
          const doc = stripMongo(l);
          if (doc.token) lMap[doc.token] = doc;
        });
        cache.sharedLinks = lMap;
        try { fs.writeFileSync(filePaths.SHARED_LINKS_FILE, JSON.stringify(lMap, null, 2)); } catch (_) {}
      } else {
        let localLinks = {};
        try { localLinks = JSON.parse(fs.readFileSync(filePaths.SHARED_LINKS_FILE, 'utf-8')); } catch (_) {}
        cache.sharedLinks = localLinks || {};
        const lList = Object.entries(cache.sharedLinks).map(([token, val]) => ({
          token,
          ...(typeof val === 'object' ? val : {})
        }));
        if (lList.length > 0) {
          await SharedLinkModel.insertMany(lList);
        }
      }
    }
  } catch (err) {
    console.error('[MongoDB Atlas] Error syncing shared links:', err.message);
  }

  // Synchronize Reports
  try {
    if (isConnected) {
      const dbReports = await ReportModel.find({}).lean();
      if (dbReports && dbReports.length > 0) {
        cache.reports = dbReports.map(stripMongo);
        try { fs.writeFileSync(filePaths.REPORTS_FILE, JSON.stringify(cache.reports, null, 2)); } catch (_) {}
      } else {
        let localReports = [];
        try { localReports = JSON.parse(fs.readFileSync(filePaths.REPORTS_FILE, 'utf-8')); } catch (_) {}
        cache.reports = Array.isArray(localReports) ? localReports : [];
        if (cache.reports.length > 0) {
          await ReportModel.insertMany(cache.reports);
        }
      }
    }
  } catch (err) {
    console.error('[MongoDB Atlas] Error syncing reports:', err.message);
  }

  // Synchronize Contacts
  try {
    if (isConnected) {
      const dbContacts = await ContactModel.find({}).lean();
      if (dbContacts && dbContacts.length > 0) {
        cache.contacts = dbContacts.map(stripMongo);
        try { fs.writeFileSync(filePaths.CONTACTS_FILE, JSON.stringify(cache.contacts, null, 2)); } catch (_) {}
      } else {
        let localContacts = [];
        try { localContacts = JSON.parse(fs.readFileSync(filePaths.CONTACTS_FILE, 'utf-8')); } catch (_) {}
        cache.contacts = Array.isArray(localContacts) ? localContacts : [];
        if (cache.contacts.length > 0) {
          await ContactModel.insertMany(cache.contacts);
        }
      }
    }
  } catch (err) {
    console.error('[MongoDB Atlas] Error syncing contacts:', err.message);
  }

  // Synchronize Visitors (cap to recent 1000)
  try {
    if (isConnected) {
      const dbVisitors = await VisitorModel.find({}).sort({ _id: -1 }).limit(1000).lean();
      if (dbVisitors && dbVisitors.length > 0) {
        cache.visitors = dbVisitors.map(stripMongo).reverse();
        try { fs.writeFileSync(filePaths.VISITORS_FILE, JSON.stringify(cache.visitors, null, 2)); } catch (_) {}
      } else {
        let localVisitors = [];
        try { localVisitors = JSON.parse(fs.readFileSync(filePaths.VISITORS_FILE, 'utf-8')); } catch (_) {}
        cache.visitors = Array.isArray(localVisitors) ? localVisitors : [];
        if (cache.visitors.length > 0) {
          await VisitorModel.insertMany(cache.visitors.slice(-300));
        }
      }
    }
  } catch (err) {
    console.error('[MongoDB Atlas] Error syncing visitors:', err.message);
  }

  // Synchronize App Configs (email_config, categories, downloads, signing_certificates)
  const configs = [
    { key: 'email_config', file: filePaths.EMAIL_CONFIG_FILE, defaultVal: defaultEmail, cacheKey: 'emailConfig' },
    { key: 'categories', file: filePaths.CATEGORIES_FILE, defaultVal: {}, cacheKey: 'categories' },
    { key: 'downloads', file: filePaths.DOWNLOADS_FILE, defaultVal: {}, cacheKey: 'downloads' },
    { key: 'signing_certificates', file: filePaths.SIGNING_CERTS_FILE, defaultVal: {}, cacheKey: 'signingCertificates' }
  ];

  for (const item of configs) {
    try {
      if (isConnected) {
        const found = await AppConfigModel.findOne({ key: item.key }).lean();
        if (found && found.value) {
          cache[item.cacheKey] = found.value;
          try { fs.writeFileSync(item.file, JSON.stringify(found.value, null, 2)); } catch (_) {}
        } else {
          let localVal = null;
          try { localVal = JSON.parse(fs.readFileSync(item.file, 'utf-8')); } catch (_) {}
          if (!localVal) localVal = item.defaultVal;
          cache[item.cacheKey] = localVal;
          if (localVal) {
            await AppConfigModel.findOneAndUpdate(
              { key: item.key },
              { key: item.key, value: localVal },
              { upsert: true }
            );
          }
        }
      }
    } catch (err) {
      console.error(`[MongoDB Atlas] Error syncing config ${item.key}:`, err.message);
    }
  }

  return true;
}

// ─── Data Access & Persistence Functions ────────────────────────────

// Users
function readUsers() {
  if (cache.users) return cache.users;
  try {
    const list = JSON.parse(fs.readFileSync(filePaths.USERS_FILE, 'utf-8'));
    if (Array.isArray(list) && list.length > 0) {
      cache.users = list;
      return list;
    }
  } catch (_) {}
  cache.users = seedUser ? [seedUser] : [];
  return cache.users;
}

function writeUsers(users) {
  cache.users = users;
  try {
    if (filePaths.USERS_FILE) fs.writeFileSync(filePaths.USERS_FILE, JSON.stringify(users, null, 2));
  } catch (err) {
    console.error('[DB] Disk write error for users:', err.message);
  }

  if (mongoose.connection.readyState === 1 && Array.isArray(users)) {
    (async () => {
      try {
        const ops = users.map(u => ({
          updateOne: {
            filter: { id: u.id },
            update: { $set: u },
            upsert: true
          }
        }));
        if (ops.length > 0) {
          await UserModel.bulkWrite(ops);
        }
        const userIds = users.map(u => u.id);
        await UserModel.deleteMany({ id: { $nin: userIds } });
      } catch (err) {
        console.error('[MongoDB Atlas] Error persisting users:', err.message);
      }
    })();
  }
}

// User Sessions
function readUserSessions() {
  if (cache.userSessions) return cache.userSessions;
  try {
    const s = JSON.parse(fs.readFileSync(filePaths.USER_SESSIONS_FILE, 'utf-8'));
    cache.userSessions = s || {};
    return cache.userSessions;
  } catch (_) {
    cache.userSessions = {};
    return cache.userSessions;
  }
}

function writeUserSessions(sessions) {
  cache.userSessions = sessions;
  try {
    if (filePaths.USER_SESSIONS_FILE) fs.writeFileSync(filePaths.USER_SESSIONS_FILE, JSON.stringify(sessions, null, 2));
  } catch (err) {
    console.error('[DB] Disk write error for sessions:', err.message);
  }

  if (mongoose.connection.readyState === 1 && sessions && typeof sessions === 'object') {
    (async () => {
      try {
        const entries = Object.entries(sessions);
        const ops = entries.map(([token, val]) => ({
          updateOne: {
            filter: { token },
            update: { $set: { token, ...(typeof val === 'object' ? val : {}) } },
            upsert: true
          }
        }));
        if (ops.length > 0) {
          await SessionModel.bulkWrite(ops);
        }
        const tokens = entries.map(([token]) => token);
        await SessionModel.deleteMany({ token: { $nin: tokens } });
      } catch (err) {
        console.error('[MongoDB Atlas] Error persisting sessions:', err.message);
      }
    })();
  }
}

// User Documents
function readUserDocuments() {
  if (cache.userDocuments) return cache.userDocuments;
  try {
    const d = JSON.parse(fs.readFileSync(filePaths.USER_DOCUMENTS_FILE, 'utf-8'));
    cache.userDocuments = Array.isArray(d) ? d : [];
    return cache.userDocuments;
  } catch (_) {
    cache.userDocuments = [];
    return cache.userDocuments;
  }
}

function writeUserDocuments(docs) {
  cache.userDocuments = docs;
  try {
    if (filePaths.USER_DOCUMENTS_FILE) fs.writeFileSync(filePaths.USER_DOCUMENTS_FILE, JSON.stringify(docs, null, 2));
  } catch (err) {
    console.error('[DB] Disk write error for user documents:', err.message);
  }

  if (mongoose.connection.readyState === 1 && Array.isArray(docs)) {
    (async () => {
      try {
        const ops = docs.map(d => ({
          updateOne: {
            filter: { id: d.id },
            update: { $set: d },
            upsert: true
          }
        }));
        if (ops.length > 0) {
          await DocumentModel.bulkWrite(ops);
        }
        const docIds = docs.map(d => d.id);
        await DocumentModel.deleteMany({ id: { $nin: docIds } });
      } catch (err) {
        console.error('[MongoDB Atlas] Error persisting documents:', err.message);
      }
    })();
  }
}

// Shared Links
function readSharedLinks() {
  if (cache.sharedLinks) return cache.sharedLinks;
  try {
    const l = JSON.parse(fs.readFileSync(filePaths.SHARED_LINKS_FILE, 'utf-8'));
    cache.sharedLinks = l || {};
    return cache.sharedLinks;
  } catch (_) {
    cache.sharedLinks = {};
    return cache.sharedLinks;
  }
}

function writeSharedLinks(links) {
  cache.sharedLinks = links;
  try {
    if (filePaths.SHARED_LINKS_FILE) fs.writeFileSync(filePaths.SHARED_LINKS_FILE, JSON.stringify(links, null, 2));
  } catch (err) {
    console.error('[DB] Disk write error for shared links:', err.message);
  }

  if (mongoose.connection.readyState === 1 && links && typeof links === 'object') {
    (async () => {
      try {
        const entries = Object.entries(links);
        const ops = entries.map(([token, val]) => ({
          updateOne: {
            filter: { token },
            update: { $set: { token, ...(typeof val === 'object' ? val : {}) } },
            upsert: true
          }
        }));
        if (ops.length > 0) {
          await SharedLinkModel.bulkWrite(ops);
        }
        const tokens = entries.map(([token]) => token);
        await SharedLinkModel.deleteMany({ token: { $nin: tokens } });
      } catch (err) {
        console.error('[MongoDB Atlas] Error persisting shared links:', err.message);
      }
    })();
  }
}

// Reports
function readReports() {
  if (cache.reports) return cache.reports;
  try {
    const r = JSON.parse(fs.readFileSync(filePaths.REPORTS_FILE, 'utf-8'));
    cache.reports = Array.isArray(r) ? r : [];
    return cache.reports;
  } catch (_) {
    cache.reports = [];
    return cache.reports;
  }
}

function writeReports(reports) {
  cache.reports = reports;
  try {
    if (filePaths.REPORTS_FILE) fs.writeFileSync(filePaths.REPORTS_FILE, JSON.stringify(reports, null, 2));
  } catch (err) {
    console.error('[DB] Disk write error for reports:', err.message);
  }

  if (mongoose.connection.readyState === 1 && Array.isArray(reports)) {
    (async () => {
      try {
        const ops = reports.map(r => ({
          updateOne: {
            filter: { id: r.id },
            update: { $set: r },
            upsert: true
          }
        }));
        if (ops.length > 0) {
          await ReportModel.bulkWrite(ops);
        }
        const reportIds = reports.map(r => r.id);
        await ReportModel.deleteMany({ id: { $nin: reportIds } });
      } catch (err) {
        console.error('[MongoDB Atlas] Error persisting reports:', err.message);
      }
    })();
  }
}

// Contacts
function readContacts() {
  if (cache.contacts) return cache.contacts;
  try {
    const c = JSON.parse(fs.readFileSync(filePaths.CONTACTS_FILE, 'utf-8'));
    cache.contacts = Array.isArray(c) ? c : [];
    return cache.contacts;
  } catch (_) {
    cache.contacts = [];
    return cache.contacts;
  }
}

function writeContacts(contacts) {
  cache.contacts = contacts;
  try {
    if (filePaths.CONTACTS_FILE) fs.writeFileSync(filePaths.CONTACTS_FILE, JSON.stringify(contacts, null, 2));
  } catch (err) {
    console.error('[DB] Disk write error for contacts:', err.message);
  }

  if (mongoose.connection.readyState === 1 && Array.isArray(contacts)) {
    (async () => {
      try {
        const ops = contacts.map(c => ({
          updateOne: {
            filter: { id: c.id || c.timestamp || Math.random().toString() },
            update: { $set: c },
            upsert: true
          }
        }));
        if (ops.length > 0) {
          await ContactModel.bulkWrite(ops);
        }
      } catch (err) {
        console.error('[MongoDB Atlas] Error persisting contacts:', err.message);
      }
    })();
  }
}

// Visitors
function readVisitors() {
  if (cache.visitors) return cache.visitors;
  try {
    const v = JSON.parse(fs.readFileSync(filePaths.VISITORS_FILE, 'utf-8'));
    cache.visitors = Array.isArray(v) ? v : [];
    return cache.visitors;
  } catch (_) {
    cache.visitors = [];
    return cache.visitors;
  }
}

function writeVisitors(visitors) {
  let bounded = Array.isArray(visitors) ? visitors : [];
  if (bounded.length > 500) {
    bounded = bounded.slice(-500);
  }
  cache.visitors = bounded;
  try {
    if (filePaths.VISITORS_FILE) fs.writeFileSync(filePaths.VISITORS_FILE, JSON.stringify(bounded, null, 2));
  } catch (err) {
    console.error('[DB] Disk write error for visitors:', err.message);
  }

  if (mongoose.connection.readyState === 1 && bounded.length > 0) {
    (async () => {
      try {
        const latest = bounded[bounded.length - 1];
        if (latest) {
          await VisitorModel.create(latest);
        }
      } catch (_) {}
    })();
  }
}

// Email Config
function readEmailConfig() {
  if (cache.emailConfig) return cache.emailConfig;
  try {
    if (filePaths.EMAIL_CONFIG_FILE && fs.existsSync(filePaths.EMAIL_CONFIG_FILE)) {
      const cfg = JSON.parse(fs.readFileSync(filePaths.EMAIL_CONFIG_FILE, 'utf-8'));
      if (cfg && (cfg.user || cfg.pass || cfg.apiKey)) {
        cache.emailConfig = cfg;
        return cfg;
      }
    }
  } catch (_) {}
  return defaultEmail || {};
}

function writeEmailConfig(config) {
  cache.emailConfig = config;
  try {
    if (filePaths.EMAIL_CONFIG_FILE) fs.writeFileSync(filePaths.EMAIL_CONFIG_FILE, JSON.stringify(config, null, 2));
  } catch (err) {
    console.error('[DB] Disk write error for email config:', err.message);
  }

  if (mongoose.connection.readyState === 1) {
    AppConfigModel.findOneAndUpdate(
      { key: 'email_config' },
      { key: 'email_config', value: config },
      { upsert: true }
    ).catch(err => console.error('[MongoDB Atlas] Error writing email config:', err.message));
  }
}

// Signing Certificates
function readSigningCertificates() {
  if (cache.signingCertificates) return cache.signingCertificates;
  try {
    const c = JSON.parse(fs.readFileSync(filePaths.SIGNING_CERTS_FILE, 'utf-8'));
    cache.signingCertificates = c || {};
    return cache.signingCertificates;
  } catch (_) {
    cache.signingCertificates = {};
    return cache.signingCertificates;
  }
}

function writeSigningCertificates(data) {
  cache.signingCertificates = data;
  try {
    if (filePaths.SIGNING_CERTS_FILE) fs.writeFileSync(filePaths.SIGNING_CERTS_FILE, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('[DB] Disk write error for signing certs:', err.message);
  }

  if (mongoose.connection.readyState === 1) {
    AppConfigModel.findOneAndUpdate(
      { key: 'signing_certificates' },
      { key: 'signing_certificates', value: data },
      { upsert: true }
    ).catch(err => console.error('[MongoDB Atlas] Error writing signing certs:', err.message));
  }
}

// Downloads
function readDownloads() {
  if (cache.downloads) return cache.downloads;
  try {
    const d = JSON.parse(fs.readFileSync(filePaths.DOWNLOADS_FILE, 'utf-8'));
    cache.downloads = d || {};
    return cache.downloads;
  } catch (_) {
    cache.downloads = {};
    return cache.downloads;
  }
}

function writeDownloads(downloads) {
  cache.downloads = downloads;
  try {
    if (filePaths.DOWNLOADS_FILE) fs.writeFileSync(filePaths.DOWNLOADS_FILE, JSON.stringify(downloads, null, 2));
  } catch (err) {
    console.error('[DB] Disk write error for downloads:', err.message);
  }

  if (mongoose.connection.readyState === 1) {
    AppConfigModel.findOneAndUpdate(
      { key: 'downloads' },
      { key: 'downloads', value: downloads },
      { upsert: true }
    ).catch(err => console.error('[MongoDB Atlas] Error writing downloads:', err.message));
  }
}

// Categories
function readCategories() {
  if (cache.categories) return cache.categories;
  try {
    const c = JSON.parse(fs.readFileSync(filePaths.CATEGORIES_FILE, 'utf-8'));
    cache.categories = c || {};
    return cache.categories;
  } catch (_) {
    cache.categories = {};
    return cache.categories;
  }
}

function writeCategories(categories) {
  cache.categories = categories;
  try {
    if (filePaths.CATEGORIES_FILE) fs.writeFileSync(filePaths.CATEGORIES_FILE, JSON.stringify(categories, null, 2));
  } catch (err) {
    console.error('[DB] Disk write error for categories:', err.message);
  }

  if (mongoose.connection.readyState === 1) {
    AppConfigModel.findOneAndUpdate(
      { key: 'categories' },
      { key: 'categories', value: categories },
      { upsert: true }
    ).catch(err => console.error('[MongoDB Atlas] Error writing categories:', err.message));
  }
}

module.exports = {
  initDatabase,
  isDbConnected: () => isConnected,
  readUsers,
  writeUsers,
  readUserSessions,
  writeUserSessions,
  readUserDocuments,
  writeUserDocuments,
  readSharedLinks,
  writeSharedLinks,
  readReports,
  writeReports,
  readContacts,
  writeContacts,
  readVisitors,
  writeVisitors,
  readEmailConfig,
  writeEmailConfig,
  readSigningCertificates,
  writeSigningCertificates,
  readDownloads,
  writeDownloads,
  readCategories,
  writeCategories,
  UserModel,
  SessionModel,
  DocumentModel,
  SharedLinkModel,
  ReportModel,
  ContactModel,
  VisitorModel,
  AppConfigModel
};

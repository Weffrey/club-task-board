// ---------------------------------------------------------------------------
// Store
//
// The only file that knows where data lives. Everything above it (app.js) just
// calls connect/saveConfig/createTask/updateTask/deleteTask and re-renders when
// the callbacks fire.
//
// Swapping Firebase for Supabase, a REST API, or anything else means rewriting
// this file and nothing else.
//
// Firestore layout:
//   boards/<BOARD_ID>              -> { name, subteams: [...] }
//   boards/<BOARD_ID>/tasks/<id>   -> { title, description, info,
//                                       subteamId, priority, status, createdAt }
// ---------------------------------------------------------------------------

import {
  firebaseConfig,
  BOARD_ID,
  DEFAULT_BOARD_NAME,
  DEFAULT_TEAMS,
  isConfigured,
} from "./config.js";

const SDK = "https://www.gstatic.com/firebasejs/10.12.0";

let mode = "demo"; // "demo" until Firebase connects
let db = null;
let boardRef = null;
let tasksRef = null;
let fs = null; // the loaded firestore module namespace

// Demo-mode data, kept in memory only.
let demo = {
  config: { name: DEFAULT_BOARD_NAME, subteams: DEFAULT_TEAMS.slice() },
  tasks: [],
};
let handlers = { onConfig: null, onTasks: null, onStatus: null };

function uid(prefix) {
  return (
    prefix + "-" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
  );
}

/**
 * Connect to the backend and start streaming.
 * @param {{onConfig:Function, onTasks:Function, onStatus:Function}} cbs
 */
export async function connect(cbs) {
  handlers = cbs;

  if (!isConfigured()) {
    startDemo("Add your Firebase keys in js/config.js to share this board.");
    return;
  }

  try {
    const [{ initializeApp }, firestore, auth] = await Promise.all([
      import(`${SDK}/firebase-app.js`),
      import(`${SDK}/firebase-firestore.js`),
      import(`${SDK}/firebase-auth.js`),
    ]);

    const app = initializeApp(firebaseConfig);
    fs = firestore;

    // Anonymous auth: every visitor gets a UID without signing up, which is
    // what firestore.rules checks for. Swap in Google sign-in if you want to
    // restrict the board to specific people (see README).
    const authInstance = auth.getAuth(app);
    await auth.signInAnonymously(authInstance);

    db = firestore.getFirestore(app);
    boardRef = firestore.doc(db, "boards", BOARD_ID);
    tasksRef = firestore.collection(db, "boards", BOARD_ID, "tasks");

    mode = "live";
    handlers.onStatus?.({ mode });

    subscribe();
  } catch (err) {
    console.error("Firebase connection failed:", err);
    startDemo("Couldn't reach Firebase — running unsaved. Check the console.");
  }
}

function startDemo(message) {
  const wasLive = mode === "live";
  mode = "demo";
  handlers.onStatus?.({ mode, message });
  // Only seed the UI when we never had real data. If a live connection dropped,
  // leave whatever is already on screen alone rather than resetting it to
  // defaults under the user.
  if (!wasLive) {
    handlers.onConfig?.(demo.config);
    handlers.onTasks?.(demo.tasks);
  }
}

function subscribe() {
  fs.onSnapshot(
    boardRef,
    (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        handlers.onConfig?.({
          name: data.name || DEFAULT_BOARD_NAME,
          subteams: Array.isArray(data.subteams) ? data.subteams : [],
        });
      } else {
        // First run against an empty project: lay down the starting board.
        fs.setDoc(boardRef, {
          name: DEFAULT_BOARD_NAME,
          subteams: DEFAULT_TEAMS,
        }).catch((e) => console.error("seed failed", e));
      }
    },
    (err) => {
      console.error("board listener failed:", err);
      startDemo("Lost the connection to Firebase — changes aren't saving.");
    }
  );

  fs.onSnapshot(
    tasksRef,
    (snap) => {
      const tasks = snap.docs.map((d) => {
        const v = d.data() || {};
        return {
          id: d.id,
          title: v.title || "Untitled task",
          description: v.description || "",
          info: v.info || "",
          subteamId: v.subteamId || "",
          priority: v.priority || "medium",
          status: v.status || "todo",
          createdAt: v.createdAt || 0,
        };
      });
      handlers.onTasks?.(tasks);
    },
    (err) => {
      console.error("tasks listener failed:", err);
      startDemo("Lost the connection to Firebase — changes aren't saving.");
    }
  );
}

export function getMode() {
  return mode;
}

export async function saveConfig(config) {
  if (mode === "demo") {
    demo.config = { name: config.name, subteams: config.subteams };
    handlers.onConfig?.(demo.config);
    return;
  }
  try {
    await fs.setDoc(boardRef, { name: config.name, subteams: config.subteams });
  } catch (err) {
    console.error("saveConfig failed", err);
  }
}

export async function createTask(task) {
  const body = { ...task, createdAt: Date.now() };
  if (mode === "demo") {
    demo.tasks = demo.tasks.concat([{ ...body, id: uid("task") }]);
    handlers.onTasks?.(demo.tasks);
    return;
  }
  try {
    await fs.addDoc(tasksRef, body);
  } catch (err) {
    console.error("createTask failed", err);
  }
}

export async function updateTask(id, patch) {
  if (mode === "demo") {
    demo.tasks = demo.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t));
    handlers.onTasks?.(demo.tasks);
    return;
  }
  try {
    await fs.updateDoc(fs.doc(db, "boards", BOARD_ID, "tasks", id), patch);
  } catch (err) {
    console.error("updateTask failed", err);
  }
}

export async function deleteTask(id) {
  if (mode === "demo") {
    demo.tasks = demo.tasks.filter((t) => t.id !== id);
    handlers.onTasks?.(demo.tasks);
    return;
  }
  try {
    await fs.deleteDoc(fs.doc(db, "boards", BOARD_ID, "tasks", id));
  } catch (err) {
    console.error("deleteTask failed", err);
  }
}

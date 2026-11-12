// ---------------------------------------------------------------------------
// Configuration
//
// Fill in firebaseConfig with the values from your own Firebase project
// (Project settings -> Your apps -> Web app). See README.md for the walkthrough.
//
// These values are NOT secrets. Firebase web config is meant to be public and
// ships in every Firebase site's source. What actually protects your data is
// firestore.rules, not hiding these keys. Commit this file normally.
//
// Leave the placeholders as-is and the board runs in demo mode: fully usable,
// but nothing is saved and nothing is shared.
// ---------------------------------------------------------------------------

export const firebaseConfig = {
  apiKey: "AIzaSyB7D5R-YP7pkVfmvOjONiDfwDIpDbklI_E",
  authDomain: "taskboard-7ce8a.firebaseapp.com",
  projectId: "taskboard-7ce8a",
  storageBucket: "taskboard-7ce8a.firebasestorage.app",
  messagingSenderId: "313689070387",
  appId: "1:313689070387:web:4b9496de69bbe567403c46",
};

// Every board lives under boards/<BOARD_ID> in Firestore. Change this if you
// ever want to run a second, separate board off the same Firebase project.
export const BOARD_ID = "main";

// Shown until someone renames the board from the header.
export const DEFAULT_BOARD_NAME = "Club Task Board";

// The subteams a brand-new board starts with. Rename them here, or just edit
// them from the gear icon once the board is running.
export const DEFAULT_TEAMS = [
  { id: "team-design", name: "Design", color: "#8E5B3F" },
  { id: "team-eng", name: "Engineering", color: "#3F6B8E" },
  { id: "team-outreach", name: "Outreach", color: "#6B4E8E" },
  { id: "team-logistics", name: "Logistics", color: "#5B7A3F" },
];

export function isConfigured() {
  return (
    !!firebaseConfig.projectId &&
    !firebaseConfig.projectId.startsWith("YOUR_")
  );
}

# Club Task Board

bllappp


A shared backlog split by subteam. Each subteam gets its own To do / In progress / Done board, every task carries a priority, a description, and a free-form "additional info" field, and an overview tab rolls everything up in one view.

No build step, no framework, no server to run. It's HTML, CSS, and three JavaScript files. Firebase handles the shared data so everyone sees the same board live.

---

## Running it locally

Clone it and serve the folder. You need a local server rather than double-clicking `index.html`, because ES modules don't load over `file://`.

```bash
git clone https://github.com/YOUR_USERNAME/club-task-board.git
cd club-task-board
python3 -m http.server 8000
```

Open <http://localhost:8000>. It runs in **demo mode** until you add Firebase keys: fully clickable, but nothing saves and nothing is shared. That's the right time to play with the design.

## Connecting Firebase (the shared part)

Free tier covers a club board with room to spare.

1. Go to <https://console.firebase.google.com> and create a project. Skip Google Analytics.
2. **Build → Firestore Database → Create database.** Start in production mode; pick a region near you.
3. **Build → Authentication → Get started → Anonymous → Enable.** This is how visitors get an identity without signing up.
4. **Project settings (gear) → Your apps → Web (`</>`).** Register the app; Firebase shows you a `firebaseConfig` object.
5. Paste those values into `js/config.js`.
6. Copy the contents of `firestore.rules` into **Firestore Database → Rules** and publish.

Reload. The demo-mode banner disappears, and the board seeds itself with the starting subteams from `js/config.js`. Open it in two browsers to watch changes sync.

> The keys in `js/config.js` are not secrets. Firebase web config is public by design and ships in the source of every Firebase site. `firestore.rules` is what protects your data. Commit `config.js` normally.

## Deploying

**GitHub Pages** — free, and enough for this:

1. Push to GitHub.
2. **Settings → Pages → Source: Deploy from a branch → `main` / `root`.**
3. A minute later it's live at `https://YOUR_USERNAME.github.io/club-task-board/`.

Add that URL to **Firebase → Authentication → Settings → Authorized domains**, or sign-in will be blocked.

Netlify and Vercel also work — drag the folder in, no configuration needed.

## Restricting access

By default anyone with the link can edit. To limit it to specific people, switch from anonymous to Google sign-in:

1. **Authentication → Sign-in method → Google → Enable.**
2. In `js/store.js`, replace the `signInAnonymously` call with `signInWithPopup` and a `GoogleAuthProvider`.
3. Tighten `firestore.rules` to an allowlist:

```
allow read, write: if request.auth != null
  && request.auth.token.email in [
    "you@example.com",
    "teammate@example.com"
  ];
```

Or allow a whole school domain: `request.auth.token.email.matches('.*@youruni[.]edu')`.

---

## How the code is laid out

```
index.html          markup shell; loads the stylesheet and js/app.js
css/styles.css      all styling, including the dark-mode palette
js/config.js        Firebase keys, starting subteams, board name
js/store.js         the only file that touches Firebase
js/app.js           state, rendering, click handling
firestore.rules     who can read and write what
```

The split matters: `app.js` never mentions Firebase. It calls `store.connect()` once and re-renders whenever data streams in, and calls `createTask` / `updateTask` / `deleteTask` / `saveConfig` to change things. **Swapping Firebase for Supabase, Pocketbase, or your own API means rewriting `store.js` and touching nothing else.**

### Data shape

```
boards/main                  { name, subteams: [{ id, name, color }] }
boards/main/tasks/<id>       { title, description, info, subteamId,
                               priority, status, createdAt }
```

`priority` is `high` | `medium` | `low`. `status` is `todo` | `doing` | `done`.

### Rendering model

`render()` rebuilds the board's HTML from `state` and assigns it to `#app`. Handlers are inline `onclick` attributes calling methods on `window.Board`. It's old-fashioned and it's deliberate: no virtual DOM, no build tooling, and the whole flow fits in one file you can read top to bottom.

The one gotcha: because re-rendering replaces the DOM, anything typed into an open modal has to be read out before the re-render. `Board.setModalField` does exactly that — copy the pattern if you add fields.

## Making changes

**Colors and fonts** — the CSS custom properties at the top of `css/styles.css`. Every color is defined once in `:root` and again in the two dark-mode blocks; change all three or dark mode drifts.

**Starting subteams** — `DEFAULT_TEAMS` in `js/config.js`. Only applies to a brand-new board; after that, use the gear icon.

**Columns** — `STATUS_LIST` in `js/app.js`. Adding a fourth status means widening `.board`'s `grid-template-columns` in the CSS.

### Things worth adding

- **Assignees** — add an `assignee` field to the task modal and render it on the card. Easiest next step.
- **Due dates** — an `<input type="date">` in the modal; sort or highlight what's overdue.
- **Drag and drop** between columns — HTML5 drag events calling `updateTask(id, { status })`.
- **Comments** — a subcollection under each task.

---

## License

MIT. Do whatever you want with it.

# Many Hands

A volunteer coordination Progressive Web App. A community shares member profiles, issues, tasks, and comments, and can see at a glance which tasks still need someone.

Built with Vite, React, React Router (HashRouter), Firebase Authentication, and Cloud Firestore. There is no custom server: `firestore.rules` is what enforces ownership. It is hosted on GitHub Pages.

## Set it up

Follow these steps in order. You need a Google account and a GitHub account.

### 1. Create the Firebase project and copy the config

1. Go to <https://console.firebase.google.com> and click **Create a project**. Google Analytics is not needed.
2. On the project overview page, click the **Web** icon (`</>`) to add a Web app. Name it `Many Hands`. Leave Firebase Hosting unchecked.
3. Firebase shows a `firebaseConfig` object. Copy its values into [`src/firebase.config.js`](src/firebase.config.js), replacing every `YOUR_...` placeholder.
4. While you're in that file, change `COMMUNITY_NAME` to your group's name.

These web config values are public by design, so it's fine to commit them. Never commit a service-account key or any other secret.

### 2. Enable email and password sign-in

In the Firebase console, go to **Build > Authentication > Get started > Sign-in method**. Click **Email/Password**, turn on the first toggle, and click **Save**.

### 3. Create the Firestore database and publish the rules

1. Go to **Build > Firestore Database > Create database**. Pick a location near your members and start in **production mode**.
2. Publish `firestore.rules` using **one** of these options.

**Option A: Firebase CLI**

```bash
npm install
```

```bash
npx firebase login
```

```bash
npx firebase deploy --only firestore:rules --project YOUR_PROJECT_ID
```

**Option B: copy and paste in the console**

Open **Firestore Database > Rules**, replace everything in the editor with the contents of [`firestore.rules`](firestore.rules), and click **Publish**.

### 4. Authorize your GitHub Pages domain

Go to **Authentication > Settings > Authorized domains > Add domain** and add `<username>.github.io`, using your GitHub username.

### 5. Push to GitHub and turn on Pages

1. Create a repository on GitHub. Naming it `many-hands` is simplest, but any name works because the deploy workflow reads the name automatically.
2. Commit your edited `src/firebase.config.js`, then push:

   ```bash
   git remote add origin https://github.com/<username>/many-hands.git
   ```

   ```bash
   git push -u origin main
   ```

3. In the repository, go to **Settings > Pages > Build and deployment > Source** and choose **GitHub Actions**.
4. Open the **Actions** tab. If the first run failed because Pages wasn't on yet, click **Re-run all jobs**.

Your site will be at `https://<username>.github.io/<repo-name>/`. Every later push to `main` deploys automatically.

### 6. Verify it works

Open the site in two separate browser profiles, or one normal window and one private window. Sign up as account A in one and account B in the other.

| As A, create | As B, check that |
| --- | --- |
| Nothing extra | **Members > A** shows no Edit button and says "Only A can edit this profile." |
| An issue | The issue shows no Edit or Delete or Add a task, and says only A and people A gave edit access can edit it. |
| A task assigned to A | The task shows no status control, Edit, or Delete, and says "Only A can edit, update or delete this task." |
| A comment on that task | The comment has no Edit or Delete. B can still add their own comment and edit it. |
| An unassigned task | **Take this task** works and assigns it to B. |

To confirm the server enforces this, and not only the UI, run the rules tests in the next section. They try these same writes directly against the rules.

Also confirm that the browser offers to install the app, and that it still opens with the network turned off once you've visited it.

### 7. Make yourself an admin

Admins get an **Admin** tab where they can kick members and edit or delete any issue. For safety, admins can only be added in the Firebase console, never from the app.

1. In the Firebase console, open **Authentication > Users** and copy the person's **User UID**.
2. Open **Firestore Database > Data**, click **Start collection**, and name it `admins`.
3. Use the UID as the **Document ID**. The document needs no fields, so add one throwaway field if the console insists (for example `note` = `admin`).

To remove an admin, delete their document from `admins`.

**What kicking does:** it adds the person to `bans`, deletes their profile, and puts their tasks back to Unclaimed. Their login still exists, but the rules refuse everything they try and the app tells them they've been removed. An admin can undo this from **Admin > Removed > Let back in**, which puts their profile back as it was. Their old tasks stay Unclaimed. To delete the login itself, use **Authentication > Users** in the console.

## Run the tests

The rules tests need Java 21 or newer for the Firebase emulator. The first run downloads the emulator.

```bash
npm install
```

```bash
npm run test:rules
```

The health label unit tests need nothing extra:

```bash
npm test
```

## Run it locally

No Firebase project is needed for this. Start the emulators in one terminal:

```bash
npm run emulators
```

Start the app in a second terminal, then open <http://localhost:5173/many-hands/>:

```bash
npm run dev:emulator
```

To check a production build:

```bash
npm run build
```

```bash
npm run preview
```

## Data model

| Collection | Fields |
| --- | --- |
| `members/{uid}` | `name`, `email`, `phone`, `createdAt` |
| `issues/{id}` | `title`, `description`, `status` (`open`, `in_progress`, `resolved`), `dueDate` (optional: a `YYYY-MM-DD` day or `null`), `ownerId`, `editorIds` (uids with edit access, always includes the owner), `createdAt` |
| `tasks/{id}` | `issueId`, `title`, `description`, `status` (`todo`, `doing`, `done`), `assigneeId` (a uid or `null`), `dueDate` (optional: a `YYYY-MM-DD` day or `null`), `repeat` (optional: `daily`, `weekly`, `biweekly`, `monthly` or `null`; needs a `dueDate`), `repeatOf` (on a task made by a repeat: the id of the task it follows), `createdBy`, `createdAt` |
| `comments/{id}` | `taskId`, `authorId`, `text`, `createdAt` |
| `admins/{uid}` | No fields needed. Added in the console only. |
| `bans/{uid}` | `name`, `email`, `phone`, `memberCreatedAt` (a saved copy of the profile), `bannedBy`, `createdAt` |

## Repeating tasks

A task with a due date can repeat every day, week, 2 weeks or month. When its holder marks it Done, the app creates the next one in the same batch: same issue, title and description, the next due date, unclaimed. The finished task's `repeat` is cleared, so the series always lives on the newest task, and finishing an old one again never makes a duplicate. To stop a series, edit the newest task and set Repeat to Never.

The next due date counts from the old due date, not the day it was finished, so the schedule doesn't drift. If a task ran so late that the next date has passed, it skips ahead to the first date that's today or later. Monthly dates keep their day, or use the last day of a shorter month.

Whoever holds a task can finish it even without edit access to its issue, so the rules let them create its follow-up too, but only in the batch that marks theirs done and clears its `repeat`.

## Known limitation

Firestore rules can't delete child documents. The UI blocks deleting an issue that still has tasks. Comments on a deleted task stay in the database, but the app only ever loads comments for a task that exists, so they never show up.

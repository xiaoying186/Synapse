# Synapse Release Acceptance Criteria

Synapse public releases must be accepted as a usable local desktop product, not
only as a buildable codebase.

## 1. Startup Acceptance

- After installing the Windows installer, Synapse can be launched from the
  Windows Start menu.
- The installed Start menu shortcut must point to the installed Synapse
  executable.
- The main window appears within 5 seconds after launch.
- The main window must not be blank, black, or only an empty shell.
- Installer smoke must preserve a screenshot rendered from the packaged main
  window handle and a nonblank visual-evidence result before uninstalling it.
- First launch shows the default Library Home view.
- The public version number is visible in the application shell.

## 2. Home Layout Acceptance

The default home page must be Library Home.

The page must include:

- A top or side primary navigation area.
- A reading pane in the upper-left area.
- A pending task panel in the upper-right area.
- A category task list below those two regions.
- A status, feedback, or activity area.

Window resizing must not cause obvious overlap, clipping, or incoherent layout
breakage on desktop or mobile viewports.

## 3. Button Feedback Acceptance

Every visible clickable button must provide at least one user-visible feedback
path:

- Page or section state changes.
- Toast or interaction feedback.
- Loading state.
- Disabled state.
- Error message.
- Activity log entry.
- Dialog, panel, or modal opens.

Buttons with no feedback are release blockers. Buttons for unfinished features
must show a clear message such as "Coming soon", "not yet implemented", or
"added to backlog".

## 4. Navigation Acceptance

The following entries must be clickable and provide visible feedback:

- Library Home.
- Zhishu / 智枢.
- Taiheng / 太衡.
- Xingtai / 行台.
- Baigong / 百工.
- Settings.
- Logs / diagnostics.

If a destination is not fully implemented, it must still show explicit user
feedback instead of doing nothing.

## 5. Installer Acceptance

Before creating a release, run a packaged-app smoke test:

- Build the Tauri installer.
- Confirm installer artifacts exist.
- Generate SHA-256 files.
- Install the Windows installer on a clean Windows environment.
- Confirm the Windows Start menu shortcut exists and targets the installed
  executable.
- Launch Synapse.
- Check the Library Home layout.
- Click all primary navigation buttons.
- Check logs for startup-level errors.
- Uninstall Synapse.
- Preserve machine-readable installer smoke evidence under
  `.tmp/release-evidence/installer-smoke.json`.

## 6. Release Blocking Conditions

Do not create a GitHub Release if any of the following are true:

- Home layout clearly diverges from the accepted Library Home structure.
- Primary buttons have no visible feedback.
- Packaged app starts as a blank or black window.
- Startup-level console or application errors are present.
- Settings or diagnostics entries cannot be opened or acknowledged.
- Version number is missing from the app shell.
- Installer artifacts or SHA-256 files are missing.
- The Start menu shortcut is missing or points to a missing executable.

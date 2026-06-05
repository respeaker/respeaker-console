# Auto Update Configuration

This guide explains the release and auto-update flow used by this project.

## Overview

This project ships as desktop bundles through GitHub Releases. It does not depend on a public web deployment for product delivery.

This project uses GitHub Releases as the updater backend. During the release workflow, GitHub Actions replaces the updater placeholders in `src-tauri/tauri.conf.json` so the application points to:

```text
https://github.com/<owner>/<repo>/releases/latest/download/latest.json
```

## Prerequisites

1. Generate a signing key pair for secure updates
2. Add the signing secrets to GitHub Actions
3. Release from the `main` branch
4. Publish releases with tags in the `vX.Y.Z` format
5. Build on GitHub-hosted runners for Windows, macOS, and Linux

## Step 1: Generate Signing Keys

Run the following command to generate a key pair:

```bash
pnpm tauri signer generate -w ~/.tauri/respeaker-console.key
```

This will output:

- **Private key**: Saved to `~/.tauri/respeaker-console.key`
- **Public key**: A string starting with `dW50cnVzdGVkIGNvbW1lbnQ6...`

Keep the private key secret.

## Step 2: Configure GitHub Secrets

Add the following secrets to your GitHub repository under Settings → Secrets and variables → Actions:

1. `TAURI_SIGNING_PRIVATE_KEY` - Content of `~/.tauri/respeaker-console.key`
2. `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` - Password you set, if any
3. `TAURI_SIGNING_PUBLIC_KEY` - Public key generated in Step 1

## Step 3: Keep Version Files in Sync

The release script expects these files to share the same version:

- `package.json`
- `src-tauri/tauri.conf.json`
- `src-tauri/Cargo.toml`

Use the release script as the single release entrypoint instead of editing only one file manually.

## Step 4: Create a Release

Run:

```bash
pnpm release:version
```

The script performs release preflight checks before it makes changes:

- Ensures the working tree is clean
- Requires the current branch to be `main`
- Verifies the three version files are consistent
- Checks that the target tag does not already exist locally or on `origin`

Then it:

- Updates all version files together
- Creates a release commit
- Creates a `vX.Y.Z` tag
- Optionally pushes the branch and tag

The GitHub Actions workflow is triggered by `v*` tags.

## Test the Release Workflow Without Publishing

Use the workflow dry run when you want to validate the latest CI/CD release build without creating a GitHub Release or changing the updater endpoint.

1. Push the code you want to test to GitHub. A temporary branch is fine:

   ```bash
   git checkout -b ci-dry-run
   git push -u origin ci-dry-run
   ```

2. Open the GitHub repository and go to Actions -> publish -> Run workflow.
3. Select the branch you pushed.
4. Keep `dry_run` enabled.
5. Run the workflow.
6. Verify that all build matrix jobs finish successfully:
   - `macos-universal`
   - `linux-x64`
   - `linux-arm64`
   - `windows-x64`
7. Download and inspect the workflow artifacts:
   - `release-assets-macos-universal`
   - `release-assets-linux-x86_64`
   - `release-assets-linux-arm64`
   - `release-assets-windows-x64`

In dry-run mode, the build artifacts use a temporary `ci-<sha>` version label and the `publish-release` job is skipped. This prevents accidental creation of a `main` or branch-named GitHub Release.

Dry runs still require the Tauri signing secrets because the release build signs updater artifacts.

## Step 5: Verify the Published Assets

After GitHub Actions finishes, verify that the latest published release contains updater assets such as:

- `latest.json`
- Windows installer and signature artifacts
- macOS app bundle, updater archive, and signature artifacts
- Linux AppImage and signature artifacts
- Signature files

If `latest.json` is missing from the latest published release, updater clients cannot discover updates.

## How It Works

1. The app checks the updater endpoint on startup or during a manual check
2. If a newer version is available, the app shows the update dialog
3. If no update is available, the manual flow reports that the app is up to date
4. If the check fails, the UI reports an error instead of treating it as up to date
5. During download, progress is calculated from cumulative downloaded bytes
6. After installation, the app relaunches automatically

## Troubleshooting

**Update check fails:**

- Check that `latest.json` exists in the latest release assets
- Confirm the signing keys are configured correctly

**No update detected:**

- Confirm the installed app version is lower than the latest release version
- Confirm the release tag uses the `vX.Y.Z` format

**Signature verification fails:**

- Make sure `TAURI_SIGNING_PRIVATE_KEY` matches `TAURI_SIGNING_PUBLIC_KEY`
- Rebuild and republish the release after correcting secrets

## Related Files

- `.github/workflows/release.yml`
- `scripts/release-version.mjs`
- `src-tauri/tauri.conf.json`

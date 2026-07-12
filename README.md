# 👻 Ghost Photo Vault

A standalone photo-vault module for the Ghost privacy suite.

## Current release

**Ghost Photo Vault v1.0 Clean**

This release consolidates the complete working build into one clean codebase.

## Features

### Albums
- Permanent Library and Favourites albums
- Permanent PIN-protected Private Vault
- Custom albums
- Touch reordering for custom albums
- Single-image custom album covers
- Four-image Library and Favourites cover collages
- Permanent locked Private Vault artwork

### Photos
- Multiple image upload
- Direct upload inside an album
- Destination chooser from the main page
- Search by filename
- Sort A–Z, Z–A, newest and oldest
- Multi-select
- Long-press to enter Select mode
- Move and delete actions
- Favourites
- Private-only pinned photos

### Viewer
- Swipe between photos
- Pinch zoom around the touch point
- Double-tap 1.5× zoom/reset
- Drag while zoomed
- Auto-hiding controls
- Rename
- Photo information
- Favourite or Private Pin
- Move
- Ghost-themed delete confirmation

### Private Vault
- Default development PIN: `1234`
- PIN stored in IndexedDB
- Private photos hidden from Library and Favourites
- Private pinned photos stay at the top
- Locked permanent album artwork

## Storage note

Photos are stored in the browser profile using IndexedDB. This development
build is not yet encrypted and its data does not automatically transfer to
another browser or device.

## Project structure

```text
index.html
css/
  photo.css
js/
  photo.js
assets/
  photo-vault.png
  private-vault-cover.png
  delete-warning.png
  home-nav.png
  hide-nav.png
  settings-nav.png
```

## Clean-build audit

- Consolidated historical CSS patches into one stylesheet
- Removed superseded viewer and Photo Info rules
- Removed unused JavaScript state and DOM references
- Removed unreachable album-management code
- Preserved the IndexedDB database name, version, stores and saved-data schema
- Kept existing photo, album, cover and PIN data compatible

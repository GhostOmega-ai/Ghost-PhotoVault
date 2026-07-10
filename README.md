# Ghost Photo Vault v0.4

Clean standalone Photo Vault module for Ghost.

## Included

- IndexedDB photo storage
- Multiple image import
- Library, Favourites and Private albums
- Custom albums: create, rename and delete
- Automatic and manual album covers
- Search and sort
- Multi-select, move and delete
- Full-screen viewer
- Previous/next controls
- Pinch zoom and drag
- Rename, favourite, move, cover and delete actions

## Important

This is a development build. Photos are stored in the current browser profile using IndexedDB. They are not encrypted yet and do not automatically transfer between browsers or devices.

## Upload structure

```text
index.html
css/photo.css
js/photo.js
assets/photo-vault.png
README.md
```


## v0.2 changes

- New supplied Photo Vault logo
- Private Vault PIN: `1234`
- Private photos are excluded from Library and Favourites
- Private Vault never displays stored-photo previews
- Permanent supplied Ghost Safe Vault cover
- Private album photo count is hidden
- Private Vault cover cannot be changed


## v0.3 album organisation

- Search remains available inside every album
- Sorting now supports Newest, Oldest, Name A–Z and Name Z–A
- Removed the Collections heading
- Library and Favourites are permanently fixed at the top
- Private Vault is permanently fixed at the bottom
- Custom albums always appear between the fixed albums
- Custom albums have a three-line drag handle for touch reordering
- Private Vault no longer displays “Protected by PIN” on its album card


## v0.4 interface update

- Albums now replaces the Ghost Photos heading
- Removed the duplicate Albums heading below the statistics
- Album pictures fill the complete card with names overlaid at the bottom
- Library, Favourites and Private Vault have special symbols
- Private Vault has no subtitle
- Picture uploads now use a Ghost-themed destination album chooser
- Added permanent Home, Hide and Settings navigation
- Favourites action is unavailable inside Private Vault
- Rename Photo now uses a Ghost-themed dialog
- Create Album Cancel now closes correctly without browser validation

# Ghost Photo Vault v0.8.2

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


## v0.5 Gallery UX

- Ghost-themed permanent-delete confirmation using the supplied artwork
- Main hero and statistics appear only on the Photo Vault home page
- Album pages now use Search, Sort, + Picture and Select controls
- Uploading inside an album adds directly to that album
- Uploading from the Photo Vault home still asks for a destination
- Moving a viewed picture closes the viewer and returns to the current album
- Every non-private photo has a faded favourite star on its thumbnail
- Favourite stars light up when active and show photos in Favourites
- Private Vault has no favourite controls
- Custom album reordering now uses live sliding/FLIP animation


## v0.8 Premium Viewer

- Removed duplicate album header and inactive three-dot button
- Gesture-first viewer with swipe navigation
- Pinch zoom centred on touch point
- Double tap toggles 1.5× zoom
- Drag while zoomed
- Auto-hiding top and bottom viewer controls
- Top viewer bar includes rename and photo information
- Bottom viewer bar includes Favourite, Move and Delete
- Photo Info includes metadata and “Use as album cover”
- Album-cover option only appears for custom albums
- Long-press a thumbnail to enter Select mode


## v0.8.1 Viewer and Cover Polish

- Pinch zoom now stays anchored beneath the exact touch midpoint
- Rename pencil moved from the viewer into the Photo Info name row
- Private Vault star now pins/unpins photos at the top of Private
- Private pinned photos never enter Favourites
- Library and Favourites support up to four selected collage-cover photos
- Photo Info displays the current Library/Favourites cover count from 0/4 to 4/4
- Selecting a fifth collage image replaces the oldest selected cover
- Custom albums retain one permanent selected cover
- Private Vault retains its permanent locked safe cover


## v0.8.2 Final Photo Info Polish

- Photo name stays visually centred inside Photo Info
- Rename pencil is fixed independently at the far-right edge
- Pencil no longer pushes the filename off-centre
- Long names truncate cleanly with an ellipsis

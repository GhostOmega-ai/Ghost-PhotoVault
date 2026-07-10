# Ghost Photo Vault v0.2

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

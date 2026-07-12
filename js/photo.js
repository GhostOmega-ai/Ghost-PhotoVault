"use strict";

const DB_NAME = "ghost-photo-vault";
const DB_VERSION = 1;
const PHOTO_STORE = "photos";
const SETTINGS_STORE = "settings";
const DEFAULT_PRIVATE_PIN = "1234";
const FIXED_TOP = ["Library", "Favourites"];

const state = {
  db: null,
  photos: [],
  customAlbums: [],
  albumCovers: {},
  album: null,
  selection: false,
  selected: new Set(),
  search: "",
  sort: "name-asc",
  viewerIds: [],
  viewerIndex: 0,
  zoom: 1,
  panX: 0,
  panY: 0,
  drag: null,
  pinchDistance: null,
  pinchZoom: 1,
  moveSingle: null,
  pendingFiles: [],
  pendingDeleteIds: [],
  deleteSource: null,
  privatePin: DEFAULT_PRIVATE_PIN,
  viewerUiVisible: true,
  viewerUiTimer: null,
  swipeStartX: null,
  swipeStartY: null,
  gestureMoved: false,
  lastTapTime: 0,
  longPressTimer: null,
  imageBaseLeft: 0,
  imageBaseTop: 0,
  pinchStartPanX: 0,
  pinchStartPanY: 0,
  pinchStartMidX: 0,
  pinchStartMidY: 0,
};

const $ = (id) => document.getElementById(id);

const el = {
  pageTitle: $("pageTitle"),
  heroSummary: $("heroSummary"),
  photoCount: $("photoCount"),
  albumCount: $("albumCount"),
  storageCount: $("storageCount"),
  albumsPage: $("albumsPage"),
  galleryPage: $("galleryPage"),
  albumGrid: $("albumGrid"),
  photoGrid: $("photoGrid"),
  albumTitle: $("albumTitle"),
  albumMeta: $("albumMeta"),
  empty: $("emptyState"),
  selectBar: $("selectBar"),
  selectedCount: $("selectedCount"),
  search: $("searchInput"),
  sort: $("sortSelect"),
  toast: $("toast"),
  albumDialog: $("albumDialog"),
  albumForm: $("albumForm"),
  albumName: $("albumName"),
  moveDialog: $("moveDialog"),
  moveChoices: $("moveChoices"),
  viewer: $("viewer"),
  viewerStage: $("viewerStage"),
  viewerImg: $("viewerImg"),
  viewerName: $("viewerName"),
  viewerPos: $("viewerPos"),
  favBtn: $("favBtn"),
  deleteDialog: $("deleteDialog"),
  deleteMessage: $("deleteMessage"),
  viewerChrome: $("viewerChrome"),
  infoDialog: $("photoInfoDialog"),
  infoAlbum: $("infoAlbum"),
  infoFavourite: $("infoFavourite"),
  infoName: $("infoName"),
  infoSize: $("infoSize"),
  infoDate: $("infoDate"),
  albumCoverToggle: $("albumCoverToggle"),
  albumCoverCount: $("albumCoverCount"),
};

function req(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function txDone(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(PHOTO_STORE)) {
        const store = db.createObjectStore(PHOTO_STORE, { keyPath: "id" });
        store.createIndex("createdAt", "createdAt");
        store.createIndex("album", "album");
      }

      if (!db.objectStoreNames.contains(SETTINGS_STORE)) {
        db.createObjectStore(SETTINGS_STORE, { keyPath: "key" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function setting(key, fallback) {
  const result = await req(
    state.db.transaction(SETTINGS_STORE).objectStore(SETTINGS_STORE).get(key)
  );
  return result ? result.value : fallback;
}

async function saveSetting(key, value) {
  const transaction = state.db.transaction(SETTINGS_STORE, "readwrite");
  transaction.objectStore(SETTINGS_STORE).put({ key, value });
  await txDone(transaction);
}

async function updatePrivatePin(newPin) {
  const cleanPin = String(newPin).replace(/\D/g, "").slice(0, 4);

  if (cleanPin.length !== 4) {
    throw new Error("Private PIN must contain exactly 4 digits.");
  }

  state.privatePin = cleanPin;
  await saveSetting("privatePin", cleanPin);
}

async function allPhotos() {
  return req(state.db.transaction(PHOTO_STORE).objectStore(PHOTO_STORE).getAll());
}

async function putPhoto(photo) {
  const transaction = state.db.transaction(PHOTO_STORE, "readwrite");
  transaction.objectStore(PHOTO_STORE).put(photo);
  await txDone(transaction);
}

async function removePhoto(id) {
  const transaction = state.db.transaction(PHOTO_STORE, "readwrite");
  transaction.objectStore(PHOTO_STORE).delete(id);
  await txDone(transaction);
}

const albums = () => [...FIXED_TOP, ...state.customAlbums, "Private"];

function photosIn(album) {
  if (album === "Library") {
    return state.photos.filter((photo) => photo.album !== "Private");
  }

  if (album === "Favourites") {
    return state.photos.filter(
      (photo) => photo.favourite && photo.album !== "Private"
    );
  }

  return state.photos.filter((photo) => photo.album === album);
}

const plural = (count, word) => `${count} ${word}${count === 1 ? "" : "s"}`;

function sizeLabel(bytes) {
  const megabytes = bytes / 1048576;

  if (megabytes < 1024) {
    return `${megabytes.toFixed(megabytes < 10 ? 1 : 0)} MB`;
  }

  return `${(megabytes / 1024).toFixed(1)} GB`;
}

const urlFor = (photo) => URL.createObjectURL(photo.blob);

function revoke(container) {
  container.querySelectorAll("img[data-url]").forEach((image) => {
    URL.revokeObjectURL(image.src);
  });
}

function toast(message) {
  el.toast.textContent = message;
  el.toast.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.toast.classList.remove("show"), 1500);
}

function handleError(error) {
  console.error(error);
  toast("Something went wrong");
}

function currentList() {
  const query = state.search.trim().toLowerCase();

  const compareBySelectedSort = (a, b) => {
    if (state.sort === "oldest") return a.createdAt - b.createdAt;
    if (state.sort === "newest") return b.createdAt - a.createdAt;
    if (state.sort === "name-desc") {
      return b.name.localeCompare(a.name, undefined, { sensitivity: "base" });
    }
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  };

  return photosIn(state.album)
    .filter((photo) => !query || photo.name.toLowerCase().includes(query))
    .sort((a, b) => {
      if (state.album === "Private") {
        const pinDifference =
          Number(Boolean(b.privatePinned)) - Number(Boolean(a.privatePinned));

        if (pinDifference) return pinDifference;
      }

      return compareBySelectedSort(a, b);
    });
}

async function refresh() {
  state.photos = await allPhotos();
  renderStats();

  if (state.album) {
    renderPhotos();
  } else {
    await renderAlbums();
  }
}

function renderStats() {
  const publicPhotos = state.photos.filter((photo) => photo.album !== "Private");
  el.photoCount.textContent = publicPhotos.length;
  el.albumCount.textContent = albums().length;
  el.heroSummary.textContent = `${plural(publicPhotos.length, "photo")} stored`;
  el.storageCount.textContent = sizeLabel(
    state.photos.reduce((total, photo) => total + (photo.size || 0), 0)
  );
}

function selectedCoverIds(album) {
  const stored = state.albumCovers[album];

  if (Array.isArray(stored)) {
    return stored.filter((id) => state.photos.some((photo) => photo.id === id));
  }

  return stored ? [stored] : [];
}

async function albumCover(album) {
  const selectedIds = selectedCoverIds(album);
  const selected = selectedIds
    .map((id) => state.photos.find((photo) => photo.id === id))
    .filter(Boolean);

  if (album === "Library" || album === "Favourites") {
    return selected.slice(0, 4);
  }

  return (
    selected[0] ||
    photosIn(album).sort((a, b) => b.createdAt - a.createdAt)[0] ||
    null
  );
}

async function renderAlbums() {
  revoke(el.albumGrid);
  el.albumGrid.replaceChildren();

  for (const album of albums()) {
    const isPrivate = album === "Private";
    const isCustom = state.customAlbums.includes(album);

    const card = document.createElement("article");
    card.className = `album-card${isPrivate ? " private-card" : ""}`;
    card.dataset.album = album;

    const open = document.createElement("button");
    open.className = "album-open";
    open.type = "button";
    open.onclick = () => requestOpenAlbum(album);

    const cover = document.createElement("div");
    cover.className = "album-cover";

    if (isPrivate) {
      const image = document.createElement("img");
      image.src = "assets/private-vault-cover.png";
      image.alt = "";
      cover.append(image);
    } else if (album === "Library" || album === "Favourites") {
      const selectedPhotos = await albumCover(album);

      if (selectedPhotos.length) {
        cover.classList.add("collage-cover");

        for (let index = 0; index < 4; index += 1) {
          const photo = selectedPhotos[index];

          if (photo) {
            const image = document.createElement("img");
            image.src = urlFor(photo);
            image.dataset.url = "1";
            image.alt = "";
            cover.append(image);
          } else {
            const emptySlot = document.createElement("span");
            emptySlot.className = "collage-empty-slot";
            cover.append(emptySlot);
          }
        }
      } else {
        const placeholder = document.createElement("span");
        placeholder.className = "album-placeholder";
        placeholder.textContent = album === "Favourites" ? "★" : "▤";
        cover.append(placeholder);
      }
    } else {
      const photo = await albumCover(album);

      if (photo) {
        const image = document.createElement("img");
        image.src = urlFor(photo);
        image.dataset.url = "1";
        image.alt = "";
        cover.append(image);
      } else {
        const placeholder = document.createElement("span");
        placeholder.className = "album-placeholder";
        placeholder.textContent = "▤";
        cover.append(placeholder);
      }
    }

    const info = document.createElement("div");
    info.className = "album-info";

    const strong = document.createElement("strong");
    const symbol = document.createElement("span");
    symbol.className = "special-album-symbol";
    symbol.textContent =
      album === "Library"
        ? "▤"
        : album === "Favourites"
          ? "★"
          : album === "Private"
            ? "🔒"
            : "";

    if (symbol.textContent) strong.append(symbol);
    strong.append(document.createTextNode(isPrivate ? "Private Vault" : album));

    const count = document.createElement("span");
    count.textContent = isPrivate ? "" : plural(photosIn(album).length, "photo");

    info.append(strong, count);
    open.append(cover, info);
    card.append(open);

    if (isCustom) {
      const handle = document.createElement("button");
      handle.className = "album-drag";
      handle.type = "button";
      handle.textContent = "≡";
      handle.setAttribute("aria-label", `Move ${album}`);
      enablePremiumAlbumDrag(handle, card, album);
      card.append(handle);
    }

    el.albumGrid.append(card);
  }
}

function snapshotAlbumPositions() {
  return new Map(
    [...el.albumGrid.querySelectorAll(".album-card")].map((card) => [
      card.dataset.album,
      card.getBoundingClientRect(),
    ])
  );
}

function animateAlbumLayout(previous) {
  el.albumGrid.classList.add("reordering");

  for (const card of el.albumGrid.querySelectorAll(".album-card")) {
    const oldRect = previous.get(card.dataset.album);
    if (!oldRect) continue;

    const newRect = card.getBoundingClientRect();
    const deltaX = oldRect.left - newRect.left;
    const deltaY = oldRect.top - newRect.top;

    if (!deltaX && !deltaY) continue;

    card.animate(
      [
        { transform: `translate(${deltaX}px, ${deltaY}px)` },
        { transform: "translate(0, 0)" },
      ],
      {
        duration: 240,
        easing: "cubic-bezier(.2,.8,.2,1)",
      }
    );
  }

  setTimeout(() => el.albumGrid.classList.remove("reordering"), 260);
}

function enablePremiumAlbumDrag(handle, card, album) {
  let active = false;
  let lastTarget = null;

  const finish = async () => {
    if (!active) return;
    active = false;
    card.classList.remove("dragging");
    lastTarget = null;
    await saveSetting("customAlbums", state.customAlbums);
    toast("Album order updated");
  };

  handle.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    event.stopPropagation();
    active = true;
    card.classList.add("dragging");
    handle.setPointerCapture(event.pointerId);
  });

  handle.addEventListener("pointermove", (event) => {
    if (!active) return;
    event.preventDefault();

    const targetCard = document
      .elementFromPoint(event.clientX, event.clientY)
      ?.closest(".album-card");

    const targetAlbum = targetCard?.dataset.album;

    if (
      !targetAlbum ||
      targetAlbum === album ||
      targetAlbum === lastTarget ||
      !state.customAlbums.includes(targetAlbum)
    ) {
      return;
    }

    const from = state.customAlbums.indexOf(album);
    const to = state.customAlbums.indexOf(targetAlbum);

    if (from < 0 || to < 0) return;

    const positions = snapshotAlbumPositions();
    state.customAlbums.splice(from, 1);
    state.customAlbums.splice(to, 0, album);

    const albumCards = [...el.albumGrid.querySelectorAll(".album-card")];
    const customCards = albumCards.filter((item) =>
      state.customAlbums.includes(item.dataset.album)
    );

    const targetIndex = state.customAlbums.indexOf(album);
    const movingCard = albumCards.find((item) => item.dataset.album === album);
    const referenceCard = customCards[targetIndex];

    if (referenceCard && movingCard !== referenceCard) {
      if (targetIndex >= customCards.indexOf(movingCard)) {
        referenceCard.after(movingCard);
      } else {
        referenceCard.before(movingCard);
      }
    }

    animateAlbumLayout(positions);
    targetCard.classList.add("swap-pulse");
    setTimeout(() => targetCard.classList.remove("swap-pulse"), 230);
    lastTarget = targetAlbum;
  });

  handle.addEventListener("pointerup", finish);
  handle.addEventListener("pointercancel", finish);

  handle.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
  });
}

function requestOpenAlbum(album) {
  if (album !== "Private") {
    openAlbum(album);
    return;
  }

  $("pinInput").value = "";
  $("pinError").classList.add("hidden");
  $("pinDialog").showModal();
  requestAnimationFrame(() => $("pinInput").focus());
}

function openAlbum(album) {
  state.album = album;
  state.search = "";
  state.sort = "name-asc";
  exitSelection(false);

  el.search.value = "";
  el.sort.value = "name-asc";
  el.albumsPage.classList.add("hidden");
  el.galleryPage.classList.remove("hidden");
  document.body.classList.add("gallery-open");
  el.pageTitle.textContent = album;
  el.albumTitle.textContent = album;

  renderPhotos();
  scrollTo({ top: 0, behavior: "smooth" });
}

async function closeAlbum() {
  exitSelection(false);
  state.album = null;
  el.galleryPage.classList.add("hidden");
  el.albumsPage.classList.remove("hidden");
  document.body.classList.remove("gallery-open");
  el.pageTitle.textContent = "Photo Vault";
  await renderAlbums();
  scrollTo({ top: 0, behavior: "smooth" });
}

function renderPhotos() {
  revoke(el.photoGrid);
  el.photoGrid.replaceChildren();

  const list = currentList();
  el.albumMeta.textContent = plural(list.length, "photo");
  el.empty.classList.toggle("hidden", list.length > 0);

  for (const photo of list) {
    const tile = document.createElement("button");
    tile.type = "button";
    tile.className = "photo-tile";
    tile.classList.toggle("selected", state.selected.has(photo.id));

    const image = document.createElement("img");
    image.src = urlFor(photo);
    image.dataset.url = "1";
    image.alt = photo.name;
    image.loading = "lazy";

    const name = document.createElement("span");
    name.className = "photo-name";
    name.textContent = photo.name;

    tile.append(image, name);

    if (state.album !== "Private") {
      const favourite = document.createElement("button");
      favourite.type = "button";
      favourite.className = `photo-favourite${photo.favourite ? " active" : ""}`;
      favourite.textContent = "★";
      favourite.setAttribute(
        "aria-label",
        photo.favourite ? "Remove from favourites" : "Add to favourites"
      );

      favourite.onclick = (event) => {
        event.stopPropagation();
        toggleTileFavourite(photo.id).catch(handleError);
      };

      tile.append(favourite);
    }

    if (state.selected.has(photo.id)) {
      const check = document.createElement("span");
      check.className = "photo-check";
      check.textContent = "✓";
      tile.append(check);
    }

    let longPressTriggered = false;

    tile.addEventListener("pointerdown", (event) => {
      if (event.pointerType === "mouse" && event.button !== 0) return;

      longPressTriggered = false;
      tile.classList.add("long-pressing");

      state.longPressTimer = setTimeout(() => {
        longPressTriggered = true;
        if (!state.selection) enterSelection();
        if (!state.selected.has(photo.id)) state.selected.add(photo.id);
        renderPhotos();

        if (navigator.vibrate) navigator.vibrate(20);
      }, 480);
    });

    const cancelLongPress = () => {
      clearTimeout(state.longPressTimer);
      tile.classList.remove("long-pressing");
    };

    tile.addEventListener("pointerup", cancelLongPress);
    tile.addEventListener("pointercancel", cancelLongPress);
    tile.addEventListener("pointerleave", cancelLongPress);

    tile.onclick = () => {
      if (longPressTriggered) {
        longPressTriggered = false;
        return;
      }

      if (state.selection) {
        toggleSelection(photo.id);
      } else {
        openViewer(photo.id);
      }
    };

    el.photoGrid.append(tile);
  }

  updateSelection();
}

function enterSelection() {
  state.selection = true;
  el.selectBar.classList.remove("hidden");
  renderPhotos();
}

function exitSelection(render = true) {
  state.selection = false;
  state.selected.clear();
  el.selectBar.classList.add("hidden");
  if (render && state.album) renderPhotos();
}

function toggleSelection(id) {
  if (state.selected.has(id)) {
    state.selected.delete(id);
  } else {
    state.selected.add(id);
  }

  renderPhotos();
}

function updateSelection() {
  el.selectedCount.textContent = `${state.selected.size} selected`;
}

async function toggleTileFavourite(id) {
  const photo = state.photos.find((item) => item.id === id);
  if (!photo || photo.album === "Private") return;

  photo.favourite = !photo.favourite;
  await putPhoto(photo);
  await refresh();
  toast(photo.favourite ? "Added to favourites" : "Removed from favourites");
}

async function importPhotos(files, targetAlbum) {
  const list = [...files].filter((file) => file.type.startsWith("image/"));
  if (!list.length) return toast("Choose one or more pictures");

  for (const file of list) {
    await putPhoto({
      id: crypto.randomUUID(),
      name: file.name || "Photo",
      type: file.type,
      size: file.size,
      createdAt: Date.now(),
      album: targetAlbum,
      favourite: false,
      privatePinned: false,
      blob: file,
    });
  }

  $("picker").value = "";
  state.pendingFiles = [];
  $("uploadDialog").close();
  toast(`${plural(list.length, "photo")} added to ${targetAlbum}`);
  await refresh();
}

function handlePickedFiles(files) {
  const list = [...files].filter((file) => file.type.startsWith("image/"));
  if (!list.length) return toast("Choose one or more pictures");

  if (state.album) {
    importPhotos(list, state.album).catch(handleError);
    return;
  }

  state.pendingFiles = list;
  $("uploadChoices").replaceChildren();

  albums()
    .filter((album) => album !== "Favourites")
    .forEach((album) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = album === "Private" ? "🔒 Private Vault" : album;
      button.onclick = () =>
        importPhotos(state.pendingFiles, album).catch(handleError);
      $("uploadChoices").append(button);
    });

  $("uploadDialog").showModal();
}

async function createAlbum(name) {
  const cleanName = name.trim();

  if (!cleanName) {
    toast("Add an album name");
    return false;
  }

  if (
    albums().some(
      (album) => album.toLowerCase() === cleanName.toLowerCase()
    )
  ) {
    toast("That album already exists");
    return false;
  }

  state.customAlbums.push(cleanName);
  await saveSetting("customAlbums", state.customAlbums);
  renderStats();
  await renderAlbums();
  toast("Album created");
  return true;
}


function openMove(single = null) {
  state.moveSingle = single;
  el.moveChoices.replaceChildren();

  const photo = single && state.photos.find((item) => item.id === single);

  albums()
    .filter((album) => !["Library", "Favourites"].includes(album))
    .filter((album) => !photo || photo.album !== album)
    .forEach((album) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = album === "Private" ? "🔒 Private Vault" : album;
      button.onclick = () => moveTo(album);
      el.moveChoices.append(button);
    });

  el.moveDialog.showModal();
}

async function moveTo(album) {
  const ids = state.moveSingle ? [state.moveSingle] : [...state.selected];

  for (const id of ids) {
    const photo = state.photos.find((item) => item.id === id);
    if (!photo) continue;

    photo.album = album;

    if (album === "Private") {
      photo.favourite = false;
      photo.privatePinned = false;
    } else {
      photo.privatePinned = false;
    }

    await putPhoto(photo);
  }

  const movedSingle = Boolean(state.moveSingle);
  state.moveSingle = null;
  el.moveDialog.close();

  if (movedSingle && el.viewer.open) {
    el.viewer.close();
  }

  exitSelection(false);
  await refresh();
  toast(`${plural(ids.length, "photo")} moved`);
}

function requestDelete(ids, source = "gallery") {
  if (!ids.length) return;

  state.pendingDeleteIds = [...ids];
  state.deleteSource = { type: source };
  el.deleteMessage.textContent = `Delete ${plural(
    ids.length,
    "photo"
  )} permanently? This cannot be undone.`;
  el.deleteDialog.showModal();
}

async function confirmDelete() {
  const ids = [...state.pendingDeleteIds];

  for (const id of ids) {
    await removePhoto(id);
  }

  state.pendingDeleteIds = [];
  state.deleteSource = null;
  el.deleteDialog.close();
  exitSelection(false);

  if (el.viewer.open) {
    el.viewer.close();
  }

  await refresh();
  toast(`${plural(ids.length, "photo")} deleted`);
}

function openViewer(id) {
  state.viewerIds = currentList().map((photo) => photo.id);
  state.viewerIndex = Math.max(0, state.viewerIds.indexOf(id));
  resetTransform();
  renderViewer();
  el.viewer.showModal();
  showViewerUi();
}

const currentPhoto = () =>
  state.photos.find(
    (photo) => photo.id === state.viewerIds[state.viewerIndex]
  );

function measureViewerImage() {
  const stageWidth = el.viewerStage.clientWidth;
  const stageHeight = el.viewerStage.clientHeight;
  const imageWidth = el.viewerImg.offsetWidth;
  const imageHeight = el.viewerImg.offsetHeight;

  state.imageBaseLeft = (stageWidth - imageWidth) / 2;
  state.imageBaseTop = (stageHeight - imageHeight) / 2;
}

function renderViewer() {
  const photo = currentPhoto();
  if (!photo) return;

  if (el.viewerImg.dataset.url) {
    URL.revokeObjectURL(el.viewerImg.src);
  }

  el.viewerImg.style.opacity = "0";
  el.viewerImg.src = urlFor(photo);
  el.viewerImg.dataset.url = "1";
  el.viewerImg.alt = photo.name;

  el.viewerImg.onload = () => {
    el.viewerImg.style.opacity = "1";
    resetTransform();
    measureViewerImage();
    applyTransform();
  };

  el.viewerName.textContent = photo.name;
  el.viewerPos.textContent = `${state.viewerIndex + 1} of ${state.viewerIds.length}`;

  const isPrivate = state.album === "Private";
  const isActive = isPrivate
    ? Boolean(photo.privatePinned)
    : Boolean(photo.favourite);

  el.favBtn.classList.remove("hidden");
  el.favBtn.classList.toggle("private-pin-action", isPrivate);
  el.favBtn.classList.toggle("active", isActive);
  el.favBtn.querySelector("span:last-child").textContent = isPrivate
    ? photo.privatePinned
      ? "Pinned"
      : "Pin"
    : photo.favourite
      ? "Favourited"
      : "Favourite";

  showViewerUi();
}

function moveViewer(step) {
  if (!state.viewerIds.length || state.zoom > 1.01) return;

  state.viewerIndex =
    (state.viewerIndex + step + state.viewerIds.length) %
    state.viewerIds.length;

  renderViewer();
}

function showViewerUi() {
  state.viewerUiVisible = true;
  el.viewerChrome.classList.remove("hidden-ui");
  clearTimeout(state.viewerUiTimer);

  state.viewerUiTimer = setTimeout(() => {
    state.viewerUiVisible = false;
    el.viewerChrome.classList.add("hidden-ui");
  }, 2200);
}

function toggleViewerUi() {
  if (state.viewerUiVisible) {
    clearTimeout(state.viewerUiTimer);
    state.viewerUiVisible = false;
    el.viewerChrome.classList.add("hidden-ui");
  } else {
    showViewerUi();
  }
}

function stagePoint(clientX, clientY) {
  const rect = el.viewerStage.getBoundingClientRect();

  return {
    x: clientX - rect.left,
    y: clientY - rect.top,
  };
}

function setZoomAround(nextZoom, clientX, clientY) {
  const oldZoom = state.zoom;
  const newZoom = Math.min(5, Math.max(1, nextZoom));
  const focal = stagePoint(clientX, clientY);

  if (newZoom === 1) {
    state.zoom = 1;
    state.panX = 0;
    state.panY = 0;
    applyTransform();
    return;
  }

  const imageX =
    (focal.x - state.imageBaseLeft - state.panX) / oldZoom;
  const imageY =
    (focal.y - state.imageBaseTop - state.panY) / oldZoom;

  state.zoom = newZoom;
  state.panX =
    focal.x - state.imageBaseLeft - imageX * newZoom;
  state.panY =
    focal.y - state.imageBaseTop - imageY * newZoom;

  applyTransform();
}

function setPinchZoom(currentTouches) {
  const currentDistance = distance(currentTouches[0], currentTouches[1]);
  const currentMiddle = midpoint(currentTouches[0], currentTouches[1]);
  const focalStart = stagePoint(
    state.pinchStartMidX,
    state.pinchStartMidY
  );
  const focalNow = stagePoint(currentMiddle.x, currentMiddle.y);
  const nextZoom = Math.min(
    5,
    Math.max(
      1,
      state.pinchZoom * (currentDistance / state.pinchDistance)
    )
  );

  const imageX =
    (focalStart.x - state.imageBaseLeft - state.pinchStartPanX) /
    state.pinchZoom;
  const imageY =
    (focalStart.y - state.imageBaseTop - state.pinchStartPanY) /
    state.pinchZoom;

  state.zoom = nextZoom;
  state.panX =
    focalNow.x - state.imageBaseLeft - imageX * nextZoom;
  state.panY =
    focalNow.y - state.imageBaseTop - imageY * nextZoom;

  if (nextZoom === 1) {
    state.panX = 0;
    state.panY = 0;
  }

  applyTransform();
}

function resetTransform() {
  state.zoom = 1;
  state.panX = 0;
  state.panY = 0;
  state.drag = null;
  state.pinchDistance = null;
  state.swipeStartX = null;
  state.swipeStartY = null;
  state.gestureMoved = false;
}

function applyTransform() {
  el.viewerImg.style.transform =
    `translate(${state.imageBaseLeft + state.panX}px, ${
      state.imageBaseTop + state.panY
    }px) scale(${state.zoom})`;
}

const distance = (a, b) =>
  Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY);

const midpoint = (a, b) => ({
  x: (a.clientX + b.clientX) / 2,
  y: (a.clientY + b.clientY) / 2,
});

function viewerTouchStart(event) {
  showViewerUi();

  if (event.touches.length === 2) {
    const middle = midpoint(event.touches[0], event.touches[1]);

    state.pinchDistance = distance(event.touches[0], event.touches[1]);
    state.pinchZoom = state.zoom;
    state.pinchStartPanX = state.panX;
    state.pinchStartPanY = state.panY;
    state.pinchStartMidX = middle.x;
    state.pinchStartMidY = middle.y;
    state.gestureMoved = true;
    return;
  }

  if (event.touches.length === 1) {
    const touch = event.touches[0];

    state.swipeStartX = touch.clientX;
    state.swipeStartY = touch.clientY;
    state.gestureMoved = false;

    if (state.zoom > 1) {
      state.drag = {
        x: touch.clientX - state.panX,
        y: touch.clientY - state.panY,
      };
    }
  }
}

function viewerTouchMove(event) {
  if (event.touches.length === 2 && state.pinchDistance) {
    event.preventDefault();
    setPinchZoom(event.touches);
    state.gestureMoved = true;
    return;
  }

  if (event.touches.length === 1) {
    const touch = event.touches[0];

    if (state.zoom > 1 && state.drag) {
      event.preventDefault();
      state.panX = touch.clientX - state.drag.x;
      state.panY = touch.clientY - state.drag.y;
      applyTransform();
      state.gestureMoved = true;
    } else if (
      state.swipeStartX !== null &&
      Math.abs(touch.clientX - state.swipeStartX) > 8
    ) {
      state.gestureMoved = true;
    }
  }
}

function viewerTouchEnd(event) {
  const changed = event.changedTouches[0];

  if (
    state.zoom <= 1.01 &&
    changed &&
    state.swipeStartX !== null &&
    state.gestureMoved
  ) {
    const deltaX = changed.clientX - state.swipeStartX;
    const deltaY = changed.clientY - state.swipeStartY;

    if (Math.abs(deltaX) > 55 && Math.abs(deltaX) > Math.abs(deltaY) * 1.2) {
      moveViewer(deltaX < 0 ? 1 : -1);
    }
  }

  state.drag = null;
  state.pinchDistance = null;
  state.swipeStartX = null;
  state.swipeStartY = null;
}

function viewerTap(event) {
  if (state.gestureMoved) return;

  const now = Date.now();

  if (now - state.lastTapTime < 320) {
    const point = event.changedTouches?.[0] || event;

    if (state.zoom > 1.01) {
      setZoomAround(1, point.clientX, point.clientY);
    } else {
      setZoomAround(1.5, point.clientX, point.clientY);
    }

    state.lastTapTime = 0;
    return;
  }

  state.lastTapTime = now;

  setTimeout(() => {
    if (Date.now() - state.lastTapTime >= 300) {
      toggleViewerUi();
    }
  }, 310);
}

async function toggleFavourite() {
  const photo = currentPhoto();
  if (!photo) return;

  if (state.album === "Private") {
    photo.privatePinned = !photo.privatePinned;
    await putPhoto(photo);
    await refresh();
    renderViewer();
    toast(photo.privatePinned ? "Pinned to top" : "Unpinned");
    return;
  }

  photo.favourite = !photo.favourite;
  await putPhoto(photo);
  await refresh();
  renderViewer();
  toast(photo.favourite ? "Added to favourites" : "Removed from favourites");
}

function openRenameDialog() {
  const photo = currentPhoto();
  if (!photo) return;

  $("renameInput").value = photo.name;
  $("renameDialog").showModal();
  requestAnimationFrame(() => $("renameInput").select());
}

async function saveRenamedPhoto() {
  const photo = currentPhoto();
  const name = $("renameInput").value.trim();

  if (!photo || !name) return;

  photo.name = name;
  await putPhoto(photo);
  $("renameDialog").close();
  await refresh();
  renderViewer();
  toast("Photo renamed");
}

function formatDate(timestamp) {
  return new Date(timestamp).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function openPhotoInfo() {
  const photo = currentPhoto();
  if (!photo) return;

  el.infoAlbum.textContent = state.album || photo.album;
  el.infoFavourite.textContent =
    state.album === "Private"
      ? photo.privatePinned
        ? "Pinned"
        : "No"
      : photo.favourite
        ? "Yes"
        : "No";
  el.infoName.textContent = photo.name;
  el.infoSize.textContent = sizeLabel(photo.size || 0);
  el.infoDate.textContent = formatDate(photo.createdAt);

  const isFourCoverAlbum =
    state.album === "Library" || state.album === "Favourites";
  const canSetCover =
    isFourCoverAlbum || state.customAlbums.includes(state.album);

  el.albumCoverToggle.classList.toggle("hidden", !canSetCover);

  if (canSetCover) {
    const selectedIds = selectedCoverIds(state.album);
    const isSelected = selectedIds.includes(photo.id);

    el.albumCoverToggle.classList.toggle("active", isSelected);
    el.albumCoverCount.textContent = isFourCoverAlbum
      ? `${selectedIds.length}/4`
      : "";
  }

  el.infoDialog.showModal();
}

async function toggleAlbumCover() {
  const photo = currentPhoto();
  if (!photo) return;

  const isFourCoverAlbum =
    state.album === "Library" || state.album === "Favourites";
  const isCustomAlbum = state.customAlbums.includes(state.album);

  if (!isFourCoverAlbum && !isCustomAlbum) return;

  if (isFourCoverAlbum) {
    let selectedIds = selectedCoverIds(state.album);
    const existingIndex = selectedIds.indexOf(photo.id);

    if (existingIndex >= 0) {
      selectedIds.splice(existingIndex, 1);
      toast("Removed from album cover");
    } else {
      selectedIds.push(photo.id);

      if (selectedIds.length > 4) {
        selectedIds = selectedIds.slice(-4);
      }

      toast("Added to album cover");
    }

    state.albumCovers[state.album] = selectedIds;
    el.albumCoverToggle.classList.toggle(
      "active",
      selectedIds.includes(photo.id)
    );
    el.albumCoverCount.textContent = `${selectedIds.length}/4`;
  } else if (state.albumCovers[state.album] === photo.id) {
    delete state.albumCovers[state.album];
    el.albumCoverToggle.classList.remove("active");
    toast("Album cover reset");
  } else {
    state.albumCovers[state.album] = photo.id;
    el.albumCoverToggle.classList.add("active");
    toast("Album cover updated");
  }

  await saveSetting("albumCovers", state.albumCovers);
}

function bind() {
  $("pinForm").onsubmit = (event) => {
    event.preventDefault();

    if ($("pinInput").value !== state.privatePin) {
      $("pinError").classList.remove("hidden");
      $("pinInput").select();
      return;
    }

    $("pinDialog").close();
    openAlbum("Private");
  };

  $("pinInput").oninput = (event) => {
    event.target.value = event.target.value.replace(/\D/g, "").slice(0, 4);
    $("pinError").classList.add("hidden");
  };

  $("pinDialog").onclose = () => {
    $("pinInput").value = "";
    $("pinError").classList.add("hidden");
  };

  $("picker").onchange = (event) => handlePickedFiles(event.target.files);

  $("newAlbumBtn").onclick = () => {
    el.albumName.value = "";
    el.albumDialog.showModal();
    requestAnimationFrame(() => el.albumName.focus());
  };

  $("cancelAlbumBtn").onclick = () => el.albumDialog.close();

  el.albumForm.onsubmit = async (event) => {
    event.preventDefault();
    if (await createAlbum(el.albumName.value)) el.albumDialog.close();
  };

  $("albumBackBtn").onclick = closeAlbum;
  $("backBtn").onclick = () => (state.album ? closeAlbum() : history.back());

  $("infoBtn").onclick = () =>
    alert(
      "Ghost Photo Vault v1.0 Clean\n\nPhotos are stored in this browser using IndexedDB. This test build is not encrypted yet."
    );

  $("selectBtn").onclick = () =>
    state.selection ? exitSelection() : enterSelection();

  $("cancelSelectBtn").onclick = () => exitSelection();

  $("moveBtn").onclick = () =>
    state.selected.size ? openMove() : toast("Select at least one photo");

  $("deleteBtn").onclick = () =>
    requestDelete([...state.selected], "gallery");

  el.search.oninput = (event) => {
    state.search = event.target.value;
    renderPhotos();
  };

  el.sort.onchange = (event) => {
    state.sort = event.target.value;
    renderPhotos();
  };

  $("closeMoveBtn").onclick = () => {
    state.moveSingle = null;
    el.moveDialog.close();
  };

  $("closeViewerBtn").onclick = () => el.viewer.close();
  $("infoBtnViewer").onclick = openPhotoInfo;

  el.viewerStage.addEventListener("touchstart", viewerTouchStart, {
    passive: true,
  });
  el.viewerStage.addEventListener("touchmove", viewerTouchMove, {
    passive: false,
  });
  el.viewerStage.addEventListener("touchend", viewerTouchEnd, {
    passive: true,
  });
  el.viewerStage.addEventListener("touchend", viewerTap, {
    passive: true,
  });

  el.viewerStage.addEventListener("click", (event) => {
    if (event.detail === 1) toggleViewerUi();
  });

  $("favBtn").onclick = () => toggleFavourite().catch(handleError);

  $("moveOneBtn").onclick = () => {
    const photo = currentPhoto();
    if (photo) openMove(photo.id);
  };

  $("deleteOneBtn").onclick = () => {
    const photo = currentPhoto();
    if (photo) requestDelete([photo.id], "viewer");
  };

  el.viewer.onclose = () => {
    clearTimeout(state.viewerUiTimer);

    if (el.viewerImg.dataset.url) {
      URL.revokeObjectURL(el.viewerImg.src);
      delete el.viewerImg.dataset.url;
    }

    resetTransform();
  };

  $("cancelUploadBtn").onclick = () => {
    $("picker").value = "";
    state.pendingFiles = [];
    $("uploadDialog").close();
  };

  $("cancelRenameBtn").onclick = () => $("renameDialog").close();

  $("renameForm").onsubmit = (event) => {
    event.preventDefault();
    saveRenamedPhoto().catch(handleError);
  };

  $("cancelDeleteBtn").onclick = () => {
    state.pendingDeleteIds = [];
    state.deleteSource = null;
    el.deleteDialog.close();
  };

  $("confirmDeleteBtn").onclick = () => confirmDelete().catch(handleError);

  $("closeInfoBtn").onclick = () => el.infoDialog.close();
  $("infoRenameBtn").onclick = () => {
    el.infoDialog.close();
    openRenameDialog();
  };
  $("albumCoverToggle").onclick = () => toggleAlbumCover().catch(handleError);

  window.addEventListener("resize", () => {
    if (!el.viewer.open || !el.viewerImg.complete) return;
    measureViewerImage();
    applyTransform();
  });

  $("vaultHomeBtn").onclick = () => {
    window.location.href = "../Ghost-Phoenix/";
  };

  $("vaultHideBtn").onclick = () => toast("Hide mode will open here");
  $("vaultSettingsBtn").onclick = () => toast("Settings will open here");
}

async function init() {
  if (!("indexedDB" in window)) {
    alert("This browser cannot run Ghost Photo Vault.");
    return;
  }

  state.db = await openDb();
  state.customAlbums = await setting("customAlbums", []);
  state.albumCovers = await setting("albumCovers", {});
  state.privatePin = await setting("privatePin", DEFAULT_PRIVATE_PIN);
  state.photos = await allPhotos();

  bind();
  renderStats();
  await renderAlbums();
}

init().catch(handleError);

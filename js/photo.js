"use strict";

const DB_NAME="ghost-photo-vault",DB_VERSION=1,PHOTO_STORE="photos",SETTINGS_STORE="settings";
const PROTECTED=["Library","Favourites","Private"],PRIVATE_PIN="1234";
const state={db:null,photos:[],customAlbums:[],albumCovers:{},album:null,selection:false,selected:new Set(),search:"",sort:"newest",viewerIds:[],viewerIndex:0,zoom:1,panX:0,panY:0,drag:null,pinchDistance:null,pinchZoom:1,moveSingle:null};
const $=id=>document.getElementById(id);
const el={pageTitle:$("pageTitle"),heroSummary:$("heroSummary"),photoCount:$("photoCount"),albumCount:$("albumCount"),storageCount:$("storageCount"),albumsPage:$("albumsPage"),galleryPage:$("galleryPage"),albumGrid:$("albumGrid"),photoGrid:$("photoGrid"),albumTitle:$("albumTitle"),albumMeta:$("albumMeta"),empty:$("emptyState"),selectBar:$("selectBar"),selectedCount:$("selectedCount"),search:$("searchInput"),sort:$("sortSelect"),toast:$("toast"),albumDialog:$("albumDialog"),albumForm:$("albumForm"),albumName:$("albumName"),moveDialog:$("moveDialog"),moveChoices:$("moveChoices"),viewer:$("viewer"),viewerStage:$("viewerStage"),viewerImg:$("viewerImg"),viewerName:$("viewerName"),viewerPos:$("viewerPos"),viewerMenu:$("viewerMenu"),favBtn:$("favBtn")};

function req(request){return new Promise((resolve,reject)=>{request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)})}
function txDone(tx){return new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error)})}
function openDb(){return new Promise((resolve,reject)=>{const request=indexedDB.open(DB_NAME,DB_VERSION);request.onupgradeneeded=()=>{const db=request.result;if(!db.objectStoreNames.contains(PHOTO_STORE)){const store=db.createObjectStore(PHOTO_STORE,{keyPath:"id"});store.createIndex("createdAt","createdAt");store.createIndex("album","album")}if(!db.objectStoreNames.contains(SETTINGS_STORE))db.createObjectStore(SETTINGS_STORE,{keyPath:"key"})};request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)})}
async function setting(key,fallback){const result=await req(state.db.transaction(SETTINGS_STORE).objectStore(SETTINGS_STORE).get(key));return result?result.value:fallback}
async function saveSetting(key,value){const tx=state.db.transaction(SETTINGS_STORE,"readwrite");tx.objectStore(SETTINGS_STORE).put({key,value});await txDone(tx)}
async function allPhotos(){return req(state.db.transaction(PHOTO_STORE).objectStore(PHOTO_STORE).getAll())}
async function putPhoto(photo){const tx=state.db.transaction(PHOTO_STORE,"readwrite");tx.objectStore(PHOTO_STORE).put(photo);await txDone(tx)}
async function removePhoto(id){const tx=state.db.transaction(PHOTO_STORE,"readwrite");tx.objectStore(PHOTO_STORE).delete(id);await txDone(tx)}
const albums=()=>["Library","Favourites",...state.customAlbums,"Private"];
const photosIn=album=>album==="Library"?state.photos.filter(p=>p.album!=="Private"):album==="Favourites"?state.photos.filter(p=>p.favourite&&p.album!=="Private"):state.photos.filter(p=>p.album===album);
const plural=(n,w)=>`${n} ${w}${n===1?"":"s"}`;
const sizeLabel=bytes=>{const mb=bytes/1048576;return mb<1024?`${mb.toFixed(mb<10?1:0)} MB`:`${(mb/1024).toFixed(1)} GB`};
const urlFor=photo=>URL.createObjectURL(photo.blob);
function revoke(container){container.querySelectorAll("img[data-url]").forEach(img=>URL.revokeObjectURL(img.src))}
function toast(message){el.toast.textContent=message;el.toast.classList.add("show");clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.toast.classList.remove("show"),1500)}
function handleError(error){console.error(error);toast("Something went wrong")}
function currentList(){
  const query=state.search.trim().toLowerCase();
  return photosIn(state.album)
    .filter(photo=>!query||photo.name.toLowerCase().includes(query))
    .sort((a,b)=>{
      if(state.sort==="oldest") return a.createdAt-b.createdAt;
      if(state.sort==="name-asc") return a.name.localeCompare(b.name,undefined,{sensitivity:"base"});
      if(state.sort==="name-desc") return b.name.localeCompare(a.name,undefined,{sensitivity:"base"});
      return b.createdAt-a.createdAt;
    });
}
async function refresh(){state.photos=await allPhotos();renderStats();state.album?renderPhotos():renderAlbums()}
function renderStats(){el.photoCount.textContent=state.photos.length;el.albumCount.textContent=albums().length;el.heroSummary.textContent=`${plural(state.photos.length,"photo")} stored`;el.storageCount.textContent=sizeLabel(state.photos.reduce((n,p)=>n+(p.size||0),0))}
async function albumCover(album){const id=state.albumCovers[album],chosen=id&&state.photos.find(p=>p.id===id);return chosen||photosIn(album).sort((a,b)=>b.createdAt-a.createdAt)[0]||null}
async function renderAlbums(){
  revoke(el.albumGrid);
  el.albumGrid.replaceChildren();

  for(const album of albums()){
    const isPrivate=album==="Private";
    const isCustom=state.customAlbums.includes(album);

    const card=document.createElement("article");
    card.className="album-card"+(isPrivate?" private-card":"");
    card.dataset.album=album;

    const open=document.createElement("button");
    open.className="album-open";
    open.type="button";
    open.onclick=()=>requestOpenAlbum(album);

    const cover=document.createElement("div");
    cover.className="album-cover";

    if(isPrivate){
      const img=document.createElement("img");
      img.src="assets/private-vault-cover.png";
      img.alt="";
      cover.append(img);
    }else{
      const photo=await albumCover(album);
      if(photo){
        const img=document.createElement("img");
        img.src=urlFor(photo);
        img.dataset.url="1";
        cover.append(img);
      }else{
        const placeholder=document.createElement("span");
        placeholder.className="album-placeholder";
        placeholder.textContent=album==="Favourites"?"♥":"▧";
        cover.append(placeholder);
      }
    }

    const info=document.createElement("div");
    info.className="album-info";

    const strong=document.createElement("strong");
    const symbol=document.createElement("span");
    symbol.className="special-album-symbol";
    symbol.textContent=album==="Library"?"▤":album==="Favourites"?"★":album==="Private"?"🔒":"";
    if(symbol.textContent) strong.append(symbol);
    strong.append(document.createTextNode(isPrivate?"Private Vault":album));

    const span=document.createElement("span");
    span.textContent=isPrivate?"":plural(photosIn(album).length,"photo");

    info.append(strong,span);
    open.append(cover,info);
    card.append(open);

    if(isCustom){
      const drag=document.createElement("button");
      drag.className="album-drag";
      drag.type="button";
      drag.textContent="≡";
      drag.setAttribute("aria-label",`Move ${album}`);
      enableAlbumDrag(drag,card,album);
      card.append(drag);
    }

    el.albumGrid.append(card);
  }
}

function enableAlbumDrag(handle,card,album){
  let active=false;
  let targetAlbum=null;

  const finish=async()=>{
    if(!active) return;
    active=false;
    card.classList.remove("dragging");
    el.albumGrid.querySelectorAll(".drop-target").forEach(item=>item.classList.remove("drop-target"));

    if(targetAlbum&&targetAlbum!==album){
      const from=state.customAlbums.indexOf(album);
      const to=state.customAlbums.indexOf(targetAlbum);

      if(from>-1&&to>-1){
        state.customAlbums.splice(from,1);
        state.customAlbums.splice(to,0,album);
        await saveSetting("customAlbums",state.customAlbums);
        await renderAlbums();
        toast("Album order updated");
      }
    }

    targetAlbum=null;
  };

  handle.addEventListener("pointerdown",event=>{
    event.preventDefault();
    event.stopPropagation();
    active=true;
    targetAlbum=null;
    card.classList.add("dragging");
    handle.setPointerCapture(event.pointerId);
  });

  handle.addEventListener("pointermove",event=>{
    if(!active) return;
    event.preventDefault();

    const element=document.elementFromPoint(event.clientX,event.clientY);
    const targetCard=element?.closest(".album-card");
    const candidate=targetCard?.dataset.album;

    el.albumGrid.querySelectorAll(".drop-target").forEach(item=>item.classList.remove("drop-target"));

    if(candidate&&candidate!==album&&state.customAlbums.includes(candidate)){
      targetAlbum=candidate;
      targetCard.classList.add("drop-target");
    }else{
      targetAlbum=null;
    }
  });

  handle.addEventListener("pointerup",finish);
  handle.addEventListener("pointercancel",finish);

  handle.addEventListener("click",event=>{
    event.preventDefault();
    event.stopPropagation();
  });
}

function requestOpenAlbum(album){if(album!=="Private")return openAlbum(album);$("pinInput").value="";$("pinError").classList.add("hidden");$("pinDialog").showModal();requestAnimationFrame(()=>$("pinInput").focus())}
function openAlbum(album){state.album=album;state.search="";state.sort="newest";exitSelection(false);el.search.value="";el.sort.value="newest";el.albumsPage.classList.add("hidden");el.galleryPage.classList.remove("hidden");el.pageTitle.textContent=album;el.albumTitle.textContent=album;renderPhotos();scrollTo({top:0,behavior:"smooth"})}
function closeAlbum(){exitSelection(false);state.album=null;el.galleryPage.classList.add("hidden");el.albumsPage.classList.remove("hidden");el.pageTitle.textContent="Photo Vault";renderAlbums();scrollTo({top:0,behavior:"smooth"})}
function renderPhotos(){revoke(el.photoGrid);el.photoGrid.replaceChildren();const list=currentList();el.albumMeta.textContent=plural(list.length,"photo");el.empty.classList.toggle("hidden",list.length>0);for(const photo of list){const tile=document.createElement("button");tile.className="photo-tile"+(state.selected.has(photo.id)?" selected":"");tile.type="button";const img=document.createElement("img");img.src=urlFor(photo);img.dataset.url="1";img.alt=photo.name;img.loading="lazy";const name=document.createElement("span");name.className="photo-name";name.textContent=photo.name;tile.append(img,name);if(state.selected.has(photo.id)){const tick=document.createElement("span");tick.className="photo-check";tick.textContent="✓";tile.append(tick)}tile.onclick=()=>state.selection?toggleSelect(photo.id):openViewer(photo.id);el.photoGrid.append(tile)}updateSelectBar()}
function enterSelection(){state.selection=true;renderPhotos()}
function exitSelection(render=true){state.selection=false;state.selected.clear();el.selectBar.classList.add("hidden");if(render&&state.album)renderPhotos()}
function toggleSelect(id){state.selected.has(id)?state.selected.delete(id):state.selected.add(id);renderPhotos()}
function updateSelectBar(){el.selectBar.classList.toggle("hidden",!state.selection);el.selectedCount.textContent=`${state.selected.size} selected`}
async function importPhotos(files,targetAlbum){
  const list=[...files].filter(file=>file.type.startsWith("image/"));
  if(!list.length)return toast("Choose one or more pictures");

  for(const file of list){
    await putPhoto({
      id:crypto.randomUUID(),
      name:file.name||"Photo",
      type:file.type,
      size:file.size,
      createdAt:Date.now(),
      album:targetAlbum,
      favourite:false,
      blob:file
    });
  }

  $("picker").value="";
  state.pendingFiles=[];
  $("uploadDialog").close();
  toast(`${plural(list.length,"photo")} added to ${targetAlbum}`);
  await refresh();
}

function chooseUploadAlbum(files){
  const list=[...files].filter(file=>file.type.startsWith("image/"));
  if(!list.length)return toast("Choose one or more pictures");

  state.pendingFiles=list;
  $("uploadChoices").replaceChildren();

  albums().filter(album=>album!=="Favourites").forEach(album=>{
    const button=document.createElement("button");
    button.type="button";
    button.textContent=album==="Private"?"🔒 Private Vault":album;
    button.onclick=()=>importPhotos(state.pendingFiles,album).catch(handleError);
    $("uploadChoices").append(button);
  });

  $("uploadDialog").showModal();
}
async function createAlbum(name){name=name.trim();if(!name)return toast("Add an album name"),false;if(albums().some(a=>a.toLowerCase()===name.toLowerCase()))return toast("That album already exists"),false;state.customAlbums.push(name);await saveSetting("customAlbums",state.customAlbums);renderStats();await renderAlbums();toast("Album created");return true}
async function manageAlbum(album){const action=prompt(`Manage \"${album}\"\n\nType R to rename or D to delete.`);if(!action)return;if(action.toLowerCase()==="r")await renameAlbum(album);if(action.toLowerCase()==="d")await deleteAlbum(album)}
async function renameAlbum(oldName){const next=prompt("New album name",oldName)?.trim();if(!next||next===oldName)return;if(albums().some(a=>a.toLowerCase()===next.toLowerCase()))return toast("That album already exists");for(const photo of state.photos.filter(p=>p.album===oldName)){photo.album=next;await putPhoto(photo)}state.customAlbums=state.customAlbums.map(a=>a===oldName?next:a);if(state.albumCovers[oldName]){state.albumCovers[next]=state.albumCovers[oldName];delete state.albumCovers[oldName]}await Promise.all([saveSetting("customAlbums",state.customAlbums),saveSetting("albumCovers",state.albumCovers)]);await refresh();toast("Album renamed")}
async function deleteAlbum(album){if(!confirm(`Delete \"${album}\"?\nPhotos will return to Library.`))return;for(const photo of state.photos.filter(p=>p.album===album)){photo.album="Library";await putPhoto(photo)}state.customAlbums=state.customAlbums.filter(a=>a!==album);delete state.albumCovers[album];await Promise.all([saveSetting("customAlbums",state.customAlbums),saveSetting("albumCovers",state.albumCovers)]);await refresh();toast("Album deleted")}
function openMove(single=null){state.moveSingle=single;el.moveChoices.replaceChildren();const photo=single&&state.photos.find(p=>p.id===single);albums().filter(a=>!['Library','Favourites'].includes(a)&&(!photo||photo.album!==a)).forEach(album=>{const b=document.createElement("button");b.textContent=album;b.onclick=()=>moveTo(album);el.moveChoices.append(b)});el.moveDialog.showModal()}
async function moveTo(album){const ids=state.moveSingle?[state.moveSingle]:[...state.selected];for(const id of ids){const p=state.photos.find(x=>x.id===id);if(p){p.album=album;await putPhoto(p)}}state.moveSingle=null;el.moveDialog.close();exitSelection(false);await refresh();toast(`${plural(ids.length,"photo")} moved`)}
async function deleteMany(ids){if(!ids.length)return;if(!confirm(`Delete ${plural(ids.length,"photo")} permanently?`))return;for(const id of ids)await removePhoto(id);exitSelection(false);await refresh();toast(`${plural(ids.length,"photo")} deleted`)}
function openViewer(id){state.viewerIds=currentList().map(p=>p.id);state.viewerIndex=Math.max(0,state.viewerIds.indexOf(id));resetTransform();renderViewer();el.viewer.showModal()}
const currentPhoto=()=>state.photos.find(p=>p.id===state.viewerIds[state.viewerIndex]);
function renderViewer(){const p=currentPhoto();if(!p)return;if(el.viewerImg.dataset.url)URL.revokeObjectURL(el.viewerImg.src);el.viewerImg.src=urlFor(p);el.viewerImg.dataset.url="1";el.viewerImg.alt=p.name;el.viewerName.textContent=p.name;el.viewerPos.textContent=`${state.viewerIndex+1} of ${state.viewerIds.length}`;el.favBtn.textContent=p.favourite?"Remove from favourites":"Add to favourites";el.favBtn.classList.toggle("hidden",state.album==="Private");$("coverBtn").classList.toggle("hidden",state.album==="Private");applyTransform()}
function moveViewer(step){if(!state.viewerIds.length)return;state.viewerIndex=(state.viewerIndex+step+state.viewerIds.length)%state.viewerIds.length;resetTransform();renderViewer()}
function setZoom(value){state.zoom=Math.min(5,Math.max(1,value));if(state.zoom===1)state.panX=state.panY=0;applyTransform()}
function resetTransform(){state.zoom=1;state.panX=state.panY=0;state.drag=null;state.pinchDistance=null}
function applyTransform(){el.viewerImg.style.transform=`translate(${state.panX}px,${state.panY}px) scale(${state.zoom})`;$("resetZoomBtn").textContent=`${state.zoom.toFixed(state.zoom%1?1:0)}×`}
const distance=(a,b)=>Math.hypot(b.clientX-a.clientX,b.clientY-a.clientY);
function touchStart(e){if(e.touches.length===2){state.pinchDistance=distance(e.touches[0],e.touches[1]);state.pinchZoom=state.zoom}else if(e.touches.length===1&&state.zoom>1)state.drag={x:e.touches[0].clientX-state.panX,y:e.touches[0].clientY-state.panY}}
function touchMove(e){e.preventDefault();if(e.touches.length===2&&state.pinchDistance){setZoom(state.pinchZoom*distance(e.touches[0],e.touches[1])/state.pinchDistance)}else if(e.touches.length===1&&state.drag&&state.zoom>1){state.panX=e.touches[0].clientX-state.drag.x;state.panY=e.touches[0].clientY-state.drag.y;applyTransform()}}
function touchEnd(){state.drag=null;state.pinchDistance=null}
async function toggleFavourite(){if(state.album==="Private")return;const p=currentPhoto();p.favourite=!p.favourite;await putPhoto(p);await refresh();renderViewer();toast(p.favourite?"Added to favourites":"Removed from favourites")}
function openRenameDialog(){
  const photo=currentPhoto();
  if(!photo)return;
  $("renameInput").value=photo.name;
  $("renameDialog").showModal();
  requestAnimationFrame(()=>$("renameInput").select());
}

async function saveRenamedPhoto(){
  const photo=currentPhoto();
  const name=$("renameInput").value.trim();
  if(!photo||!name)return;
  photo.name=name;
  await putPhoto(photo);
  $("renameDialog").close();
  await refresh();
  renderViewer();
  toast("Photo renamed");
}
async function setCover(){const p=currentPhoto();if(!p||!state.album)return;if(state.album==="Private")return toast("Private Vault cover is locked");state.albumCovers[state.album]=p.id;await saveSetting("albumCovers",state.albumCovers);toast("Album cover updated")}
async function deleteCurrent(){const p=currentPhoto();if(!p||!confirm(`Delete \"${p.name}\" permanently?`))return;await removePhoto(p.id);state.viewerIds.splice(state.viewerIndex,1);if(!state.viewerIds.length){el.viewer.close();await refresh();return toast("Photo deleted")}if(state.viewerIndex>=state.viewerIds.length)state.viewerIndex--;await refresh();renderViewer();toast("Photo deleted")}

function bind(){
$("pinForm").onsubmit=e=>{e.preventDefault();if($("pinInput").value!==PRIVATE_PIN){$("pinError").classList.remove("hidden");$("pinInput").select();return}$("pinDialog").close();openAlbum("Private")};
$("pinInput").oninput=e=>{e.target.value=e.target.value.replace(/\D/g,"").slice(0,4);$("pinError").classList.add("hidden")};
$("pinDialog").onclose=()=>{$("pinInput").value="";$("pinError").classList.add("hidden")};
$("picker").onchange=e=>chooseUploadAlbum(e.target.files);$("newAlbumBtn").onclick=()=>{el.albumName.value="";el.albumDialog.showModal();requestAnimationFrame(()=>el.albumName.focus())};$("cancelAlbumBtn").onclick=()=>el.albumDialog.close();el.albumForm.onsubmit=async e=>{e.preventDefault();if(await createAlbum(el.albumName.value))el.albumDialog.close()};$("albumBackBtn").onclick=closeAlbum;$("backBtn").onclick=()=>state.album?closeAlbum():history.back();$("infoBtn").onclick=()=>alert("Ghost Photo Vault v0.4\n\nPhotos are stored in this browser using IndexedDB. This test build is not encrypted yet.");$("selectBtn").onclick=()=>state.selection?exitSelection():enterSelection();$("cancelSelectBtn").onclick=()=>exitSelection();$("moveBtn").onclick=()=>state.selected.size?openMove():toast("Select at least one photo");$("deleteBtn").onclick=()=>deleteMany([...state.selected]).catch(handleError);el.search.oninput=e=>{state.search=e.target.value;renderPhotos()};el.sort.onchange=e=>{state.sort=e.target.value;renderPhotos()};$("closeMoveBtn").onclick=()=>{state.moveSingle=null;el.moveDialog.close()};$("closeViewerBtn").onclick=()=>el.viewer.close();$("viewerMenuBtn").onclick=()=>el.viewerMenu.classList.toggle("hidden");el.viewer.onclick=e=>{if(!el.viewerMenu.contains(e.target)&&e.target.id!=="viewerMenuBtn")el.viewerMenu.classList.add("hidden")};$("prevBtn").onclick=()=>moveViewer(-1);$("nextBtn").onclick=()=>moveViewer(1);$("zoomOutBtn").onclick=()=>setZoom(state.zoom-.5);$("zoomInBtn").onclick=()=>setZoom(state.zoom+.5);$("resetZoomBtn").onclick=()=>{resetTransform();applyTransform()};el.viewerStage.addEventListener("touchstart",touchStart,{passive:true});el.viewerStage.addEventListener("touchmove",touchMove,{passive:false});el.viewerStage.addEventListener("touchend",touchEnd,{passive:true});$("favBtn").onclick=()=>toggleFavourite().catch(handleError);$("renameBtn").onclick=openRenameDialog;$("moveOneBtn").onclick=()=>{const p=currentPhoto();el.viewerMenu.classList.add("hidden");if(p)openMove(p.id)};$("coverBtn").onclick=()=>setCover().catch(handleError);$("deleteOneBtn").onclick=()=>deleteCurrent().catch(handleError);el.viewer.onclose=()=>{if(el.viewerImg.dataset.url){URL.revokeObjectURL(el.viewerImg.src);delete el.viewerImg.dataset.url}el.viewerMenu.classList.add("hidden");resetTransform()};
$("cancelUploadBtn").onclick=()=>{$("picker").value="";state.pendingFiles=[];$("uploadDialog").close()};
$("cancelRenameBtn").onclick=()=>$("renameDialog").close();
$("renameForm").onsubmit=e=>{e.preventDefault();saveRenamedPhoto().catch(handleError)};
$("vaultHomeBtn").onclick=()=>{window.location.href="../Ghost-Phoenix/"};
$("vaultHideBtn").onclick=()=>toast("Hide mode will open here");
$("vaultSettingsBtn").onclick=()=>toast("Settings will open here")
}
async function init(){if(!("indexedDB" in window))return alert("This browser cannot run Ghost Photo Vault.");state.db=await openDb();state.customAlbums=await setting("customAlbums",[]);state.albumCovers=await setting("albumCovers",{});state.photos=await allPhotos();bind();renderStats();await renderAlbums()}
init().catch(handleError);

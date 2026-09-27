/**
 * The library: one category of a catalogue as a shelf of generated books (docs/LIBRARY.md).
 *
 * The shelf is a view, not the catalogue: every book is a real dataset with a real link, all of
 * them are on the shelf (and in the list below it), order is alphabetical within a group, and a
 * search lights books up without moving any. Everything you must read is HTML, not 3D text.
 * Without WebGL, or with reduced motion, the same shelf is drawn in 2D / without animation.
 */
import * as THREE from 'three';
import { icon } from '../ui/icons';
import { layoutShelf, type ShelfLayout } from './layout';
import type { LibraryBook, LibraryData } from './types';

const H = 168;          // book height (cover SVG units)
const D = 120;          // book depth = cover width
const TAB = 10;         // SVG headroom above the book (doorway tab)
const BOARD_W = 560;
const BOARD_GAP = 58;   // vertical space between boards, above the books
const PULL = 16;        // how far the doorway book stands out
const PAPER = 0xf4f0e6;

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const params = new URLSearchParams(location.search);
const dataUrl = `/library/${params.get('portal') ?? 'bs'}-${params.get('shelf') ?? 'mobility-transport'}.json`;

const $ = <T extends HTMLElement>(selector: string): T => document.querySelector<T>(selector)!;
const esc = (text: string): string => text.replace(/[&<>"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char]!));
const fmt = (value: number | null): string => (value === null ? 'unknown' : new Intl.NumberFormat('de-CH').format(value));

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

const data: LibraryData = await fetch(dataUrl).then(response => {
  if (!response.ok) throw new Error(`${dataUrl}: HTTP ${response.status}`);
  return response.json();
});
const books: LibraryBook[] = data.groups.flatMap(group => group.books);
const groupOf = new Map(data.groups.flatMap(group => group.books.map(book => [book.id, group.name] as const)));
const layout: ShelfLayout = layoutShelf(data.groups.map(group => ({ name: group.name, items: group.books.map(book => ({ id: book.id, width: book.spineWidth })) })), BOARD_W);
const placed = new Map(layout.books.map(book => [book.id, book]));

$('#shelfTitle').textContent = data.category;
$('#shelfMeta').textContent = `${books.length} datasets · ${data.portal.label} · snapshot ${data.asOf}`;
$('#legendUsage').textContent = data.usage;

// ---------------------------------------------------------------------------
// Shared HTML: list, panel, search, announcements
// ---------------------------------------------------------------------------

const live = $('#live');
const announce = (text: string): void => { live.textContent = text; };

function bookSummary(book: LibraryBook): string {
  return `${book.title}. ${book.form}, ${fmt(book.records)} records.${book.reuses ? ` ${book.reuses} documented reuse${book.reuses === 1 ? '' : 's'}.` : ''}${book.overdueNote ? ` ${book.overdueNote}` : ''}${book.doorway ? ' Ready, rarely used.' : ''}`;
}

$('#list').innerHTML = data.groups.map(group => `<section><h3>${group.glyph}${esc(group.name)} <small>${group.books.length}</small></h3><ul>${group.books.map(book => `<li><button data-id="${esc(book.id)}">${esc(book.title)} <small>${esc(book.id)} · ${esc(book.form)}</small>${book.doorway ? ' <span class="tag">ready, rarely used</span>' : ''}</button></li>`).join('')}</ul></section>`).join('');
$('#listCount').textContent = String(books.length);

const panel = $('#panel');
function showPanel(book: LibraryBook): void {
  const catalogue = `/catalogue/?portal=${encodeURIComponent(data.portal.id)}#dataset=${encodeURIComponent(book.id)}`;
  panel.innerHTML = `<button class="close" aria-label="Put the book back">${icon('close', { size: 18 })}</button>
    <div class="page left">${book.cover}<p class="gen">Cover generated from metadata and a small real sample.</p></div>
    <div class="page right">
      <p class="eyebrow">${esc(groupOf.get(book.id) ?? '')} · ${esc(book.id)}</p>
      <h2 id="panelTitle">${esc(book.title)}</h2>
      ${book.doorway ? `<p class="door"><b>Ready, rarely used.</b> ${esc(book.doorwayReason ?? '')}</p>` : ''}
      <p>${esc(book.description || 'No description published.')}</p>
      <dl>
        <dt>Form</dt><dd>${esc(book.form)}</dd>
        <dt>Records</dt><dd>${fmt(book.records)} <small>(${esc(book.bandLabel)})</small></dd>
        <dt>Publisher</dt><dd>${esc(book.publisher || 'not published')}</dd>
        <dt>Update rhythm</dt><dd>${esc(book.cadence ?? 'not declared')}${book.overdueNote ? ` <span class="late">${esc(book.overdueNote)}</span>` : ''}</dd>
        <dt>Documented reuse</dt><dd>${book.reuses || 'none'}</dd>
      </dl>
      <p class="links"><a href="${esc(catalogue)}">Open in the catalogue</a><a href="${esc(book.sourceUrl)}" target="_blank" rel="noreferrer">Source on ${esc(data.portal.site.replace(/^https?:\/\//, '') || 'the portal')} ${icon('external', { size: 14 })}</a></p>
    </div>`;
  panel.hidden = false;
  panel.setAttribute('aria-labelledby', 'panelTitle');
  panel.querySelector<HTMLButtonElement>('.close')!.addEventListener('click', () => shelf.close());
  panel.querySelector<HTMLElement>('.close')!.focus({ preventScroll: true });
}
function hidePanel(): void { panel.hidden = true; panel.innerHTML = ''; }

function matches(book: LibraryBook, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const hay = `${book.title} ${book.description} ${book.form} ${book.id} ${groupOf.get(book.id)}`.toLowerCase();
  return q.split(/\s+/).every(term => hay.includes(term));
}

// ---------------------------------------------------------------------------
// The shelf: 3D when possible, 2D otherwise, same data and behaviour
// ---------------------------------------------------------------------------

interface Shelf { open(id: string): void; close(): void; focus(id: string): void; highlight(query: string): number }

function webglAvailable(): boolean {
  try { const canvas = document.createElement('canvas'); return !!(canvas.getContext('webgl2') || canvas.getContext('webgl')); } catch { return false; }
}

const shelf: Shelf = webglAvailable() && params.get('mode') !== '2d' ? await createShelf3d() : createShelf2d();

$('#list').addEventListener('click', event => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-id]');
  if (!button) return;
  $('#stage').scrollIntoView({ block: 'center', behavior: reduced ? 'auto' : 'smooth' });
  shelf.open(button.dataset.id!);
});
$<HTMLInputElement>('#search').addEventListener('input', event => {
  const query = (event.target as HTMLInputElement).value;
  const n = shelf.highlight(query);
  $('#searchCount').textContent = query.trim() ? `${n} of ${books.length} light up; nothing moves` : '';
  document.querySelectorAll<HTMLElement>('#list button[data-id]').forEach(button => {
    button.classList.toggle('dim', !!query.trim() && !matches(books.find(book => book.id === button.dataset.id)!, query));
  });
});
window.addEventListener('keydown', event => { if (event.key === 'Escape' && !panel.hidden) shelf.close(); });
const initial = location.hash.match(/dataset=([\w.-]+)/)?.[1];
if (initial && placed.has(initial)) shelf.open(initial);

// ---------------------------------------------------------------------------
// 2D fallback: the spines as they are
// ---------------------------------------------------------------------------

function createShelf2d(): Shelf {
  document.body.classList.add('mode-2d');
  const stage = $('#stage');
  const boards = Array.from({ length: layout.boards }, (_, board) => layout.books.filter(book => book.board === board));
  stage.innerHTML = `<div class="shelf2d">${boards.map(row => `<div class="board2d">${row.map(item => {
    const book = books.find(b => b.id === item.id)!;
    return `<button class="spine2d ${book.doorway ? 'door' : ''}" data-id="${esc(book.id)}" aria-label="${esc(bookSummary(book))}" style="width:${book.spineWidth}px">${book.spine}</button>`;
  }).join('')}</div>`).join('')}</div>`;
  stage.addEventListener('click', event => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-id]');
    if (button) api.open(button.dataset.id!);
  });
  const api: Shelf = {
    open(id) { const book = books.find(b => b.id === id); if (book) { showPanel(book); announce(`Opened: ${bookSummary(book)}`); } },
    close() { hidePanel(); },
    focus(id) { stage.querySelector<HTMLButtonElement>(`[data-id="${CSS.escape(id)}"]`)?.focus(); },
    highlight(query) {
      let n = 0;
      stage.querySelectorAll<HTMLElement>('.spine2d').forEach(el => { const hit = matches(books.find(b => b.id === el.dataset.id)!, query); el.classList.toggle('dim', !hit); if (hit) n++; });
      return n;
    },
  };
  return api;
}

// ---------------------------------------------------------------------------
// 3D shelf
// ---------------------------------------------------------------------------

async function svgTexture(svg: string, width: number, height: number, crop: { top: number }): Promise<THREE.CanvasTexture> {
  const scale = 4;
  const image = new Image();
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error('svg')); image.src = url; });
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  // The SVG carries headroom for the doorway tab above the book; draw only the book itself.
  canvas.getContext('2d')!.drawImage(image, 0, crop.top * image.naturalHeight / (height + crop.top), image.naturalWidth, image.naturalHeight * height / (height + crop.top), 0, 0, canvas.width, canvas.height);
  URL.revokeObjectURL(url);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

async function createShelf3d(): Promise<Shelf> {
  const stage = $('#stage');
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  stage.append(renderer.domElement);
  renderer.domElement.setAttribute('aria-hidden', 'true');

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(28, 1, 10, 6000);
  scene.add(new THREE.HemisphereLight(0xffffff, 0xd8cfbd, 1.9));
  const key = new THREE.DirectionalLight(0xffffff, 1.6);
  key.position.set(-300, 500, 700);
  scene.add(key);

  const rowPitch = H + BOARD_GAP;
  const totalW = BOARD_W + 40;
  const totalH = layout.boards * rowPitch + 20;
  const boardY = (board: number) => (layout.boards - 1 - board) * rowPitch - totalH / 2 + 30;
  const bookX = (x: number, width: number) => x + width / 2 - BOARD_W / 2;

  // Case: back panel, sides, boards.
  const wood = new THREE.MeshStandardMaterial({ color: 0xe6dfcf, roughness: 0.9 });
  const back = new THREE.Mesh(new THREE.BoxGeometry(totalW, totalH + 20, 4), new THREE.MeshStandardMaterial({ color: 0xd9d1bf, roughness: 1 }));
  back.position.set(0, 0, -D / 2 - 6);
  scene.add(back);
  for (let board = 0; board < layout.boards; board++) {
    const plank = new THREE.Mesh(new THREE.BoxGeometry(totalW, 8, D + 24), wood);
    plank.position.set(0, boardY(board) - 4, 4);
    scene.add(plank);
  }
  for (const side of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(10, totalH + 20, D + 24), wood);
    post.position.set(side * (totalW / 2 + 5), 0, 4);
    scene.add(post);
  }
  // Bookends where groups share a board.
  for (const start of layout.starts) {
    if (start.x === 0) continue;
    const end = new THREE.Mesh(new THREE.BoxGeometry(3, 60, D * 0.8), new THREE.MeshStandardMaterial({ color: 0x9c9383, roughness: 0.6, metalness: 0.2 }));
    end.position.set(start.x - 4 - BOARD_W / 2, boardY(start.board) + 30, 0);
    scene.add(end);
  }

  // Books.
  const paperEdge = new THREE.MeshStandardMaterial({ color: PAPER, roughness: 0.95 });
  interface Book3d { book: LibraryBook; mesh: THREE.Mesh; home: THREE.Vector3; spineMat: THREE.MeshStandardMaterial; coverMat: THREE.MeshStandardMaterial }
  const meshes: Book3d[] = [];
  await Promise.all(books.map(async book => {
    const spot = placed.get(book.id)!;
    const spineMat = new THREE.MeshStandardMaterial({ map: await svgTexture(book.spine, book.spineWidth, H, { top: TAB }), roughness: 0.85 });
    const coverMat = new THREE.MeshStandardMaterial({ map: await svgTexture(book.cover, D, H, { top: TAB }), roughness: 0.8 });
    const cloth = new THREE.MeshStandardMaterial({ color: new THREE.Color(0x2b5c73), roughness: 0.85 });
    // Box faces: +x, -x, +y, -y, +z (spine, towards the viewer), -z.
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(book.spineWidth, H, D), [coverMat, cloth, paperEdge, paperEdge, spineMat, paperEdge]);
    const home = new THREE.Vector3(bookX(spot.x, spot.width), boardY(spot.board) + H / 2, book.doorway ? PULL : 0);
    mesh.position.copy(home);
    mesh.userData.id = book.id;
    scene.add(mesh);
    if (book.doorway) {
      const tab = new THREE.Mesh(new THREE.BoxGeometry(Math.max(6, book.spineWidth - 3), 9, 1.5), paperEdge);
      tab.position.set(0, H / 2 + 3, D / 2 - 2);
      mesh.add(tab);
    }
    meshes.push({ book, mesh, home, spineMat, coverMat });
  }));
  const byId = new Map(meshes.map(item => [item.book.id, item]));

  // Group labels (HTML, projected once per resize).
  const labels = $('#labels');
  labels.innerHTML = layout.starts.map(start => {
    const group = data.groups.find(g => g.name === start.group)!;
    return `<div class="glabel" data-group="${esc(start.group)}">${group.glyph}<span>${esc(start.group)}</span><b>${group.books.length}</b></div>`;
  }).join('');

  // Camera fit, parallax, resize.
  const target = new THREE.Vector3(0, 0, 0);
  let base = new THREE.Vector3();
  const pointer = { x: 0, y: 0 };
  function fit(): void {
    const { clientWidth: w, clientHeight: h } = stage;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const vFov = THREE.MathUtils.degToRad(camera.fov);
    const distH = (totalH * 1.12) / (2 * Math.tan(vFov / 2));
    const distW = (totalW * 1.08) / (2 * Math.tan(vFov / 2) * camera.aspect);
    base = new THREE.Vector3(0, 0, Math.max(distH, distW) + D);
    camera.updateProjectionMatrix();
    camera.position.copy(base);
    camera.lookAt(target);
    camera.updateMatrixWorld();
    // Labels sit on the board's lip; when two would overlap, the later one moves above the books.
    let previous: { board: number; right: number } | null = null;
    for (const start of layout.starts) {
      const el = labels.querySelector<HTMLElement>(`[data-group="${CSS.escape(start.group)}"]`)!;
      const below = new THREE.Vector3(start.x - BOARD_W / 2 + 2, boardY(start.board) - 10, D / 2 + 14).project(camera);
      const left = ((below.x + 1) / 2) * w;
      // A clashing label takes a second line under the same board, so it stays with its books.
      const clash = previous && previous.board === start.board && left < previous.right + 6;
      el.style.left = `${left}px`;
      el.style.top = `${((1 - below.y) / 2) * h + (clash ? el.offsetHeight + 4 : 0)}px`;
      el.classList.toggle('above', !!clash);
      if (!clash) previous = { board: start.board, right: left + el.offsetWidth };
    }
  }
  new ResizeObserver(fit).observe(stage);
  fit();

  // Interaction state.
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let hovered: Book3d | null = null;
  let focused: Book3d | null = null;
  let opened: Book3d | null = null;
  const tip = $('#tip');

  type Tween = { item: Book3d; from: THREE.Vector3; to: THREE.Vector3; fromRot: number; toRot: number; t: number; done?: () => void };
  const tweens: Tween[] = [];
  function moveTo(item: Book3d, to: THREE.Vector3, rot: number, done?: () => void): void {
    const tween = { item, from: item.mesh.position.clone(), to, fromRot: item.mesh.rotation.y, toRot: rot, t: reduced ? 1 : 0, done };
    for (let i = tweens.length - 1; i >= 0; i--) if (tweens[i].item === item) tweens.splice(i, 1);
    tweens.push(tween);
  }

  function lift(item: Book3d | null, on: boolean): void {
    if (!item || item === opened) return;
    moveTo(item, item.home.clone().add(new THREE.Vector3(0, on ? 7 : 0, on ? 6 : 0)), 0);
  }

  function pick(event: PointerEvent): Book3d | null {
    const rect = renderer.domElement.getBoundingClientRect();
    ndc.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const hit = raycaster.intersectObjects(meshes.map(item => item.mesh), false)[0];
    return hit ? byId.get(hit.object.userData.id as string) ?? null : null;
  }

  renderer.domElement.addEventListener('pointermove', event => {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = ((event.clientY - rect.top) / rect.height) * 2 - 1;
    if (opened) return;
    const item = pick(event);
    if (item !== hovered) { lift(hovered, false); hovered = item; lift(hovered, true); }
    renderer.domElement.style.cursor = item ? 'pointer' : 'default';
    if (item) {
      tip.hidden = false;
      tip.innerHTML = `<b>${esc(item.book.title)}</b><span>${esc(item.book.form)} · ${fmt(item.book.records)} records${item.book.reuses ? ` · ${item.book.reuses} reuse${item.book.reuses === 1 ? '' : 's'}` : ''}${item.book.doorway ? ' · ready, rarely used' : ''}</span>`;
      tip.style.left = `${event.clientX - rect.left + 14}px`;
      tip.style.top = `${event.clientY - rect.top + 14}px`;
    } else tip.hidden = true;
  });
  renderer.domElement.addEventListener('pointerleave', () => { lift(hovered, false); hovered = null; tip.hidden = true; });
  renderer.domElement.addEventListener('click', event => { const item = pick(event); if (item && !opened) api.open(item.book.id); });

  // Keyboard: the stage is one focusable control; arrows move a focus ring over the books.
  stage.tabIndex = 0;
  stage.setAttribute('role', 'application');
  stage.setAttribute('aria-label', `Shelf of ${books.length} datasets. Arrow keys move between books, Enter opens, Escape puts it back.`);
  const order = layout.books.map(book => byId.get(book.id)!);
  stage.addEventListener('keydown', event => {
    if (opened) return;
    const index = focused ? order.indexOf(focused) : -1;
    let next: Book3d | undefined;
    if (event.key === 'ArrowRight') next = order[Math.min(order.length - 1, index + 1)];
    else if (event.key === 'ArrowLeft') next = order[Math.max(0, index - 1)];
    else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      const here = focused ? placed.get(focused.book.id)! : layout.books[0];
      const board = here.board + (event.key === 'ArrowDown' ? 1 : -1);
      const row = layout.books.filter(book => book.board === board);
      if (row.length) next = byId.get(row.reduce((best, book) => (Math.abs(book.x - here.x) < Math.abs(best.x - here.x) ? book : best)).id);
    } else if (event.key === 'Enter' && focused) { api.open(focused.book.id); event.preventDefault(); return; }
    if (next) { event.preventDefault(); api.focus(next.book.id); }
  });

  let query = '';
  function paint(): void {
    for (const item of meshes) {
      const hit = matches(item.book, query);
      const tint = !query.trim() ? 1 : hit ? 1.25 : 0.22;
      for (const mat of [item.spineMat, item.coverMat]) mat.color.setScalar(tint);
      const glow = item === focused ? 0.22 : query.trim() && hit ? 0.16 : 0;
      for (const mat of [item.spineMat, item.coverMat]) { mat.emissive.setRGB(glow, glow * 0.9, glow * 0.6); }
    }
  }

  const api: Shelf = {
    open(id) {
      const item = byId.get(id);
      if (!item) return;
      if (opened && opened !== item) api.close();
      opened = item;
      hovered = null;
      tip.hidden = true;
      // Pull the book out towards the viewer and turn it to show its cover (+x face): at a distance
      // where it fills ~65% of the view height, centred in the part of the view the panel leaves free.
      const tan = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
      const distance = H / (0.65 * 2 * tan);
      const visibleWidth = 2 * distance * tan * camera.aspect;
      const panelShare = panel.parentElement ? Math.min(0.6, 640 / panel.parentElement.clientWidth) : 0.45;
      const front = new THREE.Vector3(base.x - visibleWidth / 2 + (visibleWidth * (1 - panelShare)) / 2, base.y, base.z - distance);
      moveTo(item, front, -Math.PI / 2, () => showPanel(item.book));
      document.body.classList.add('book-open');
      announce(`Opened: ${bookSummary(item.book)}`);
    },
    close() {
      if (!opened) return;
      const item = opened;
      opened = null;
      hidePanel();
      document.body.classList.remove('book-open');
      moveTo(item, item.home.clone(), 0);
      stage.focus({ preventScroll: true });
    },
    focus(id) {
      const item = byId.get(id);
      if (!item) return;
      lift(focused, false);
      focused = item;
      lift(focused, true);
      paint();
      announce(`${groupOf.get(id)}: ${bookSummary(item.book)}`);
    },
    highlight(q) { query = q; paint(); return meshes.filter(item => matches(item.book, q)).length; },
  };

  const clock = new THREE.Clock();
  renderer.setAnimationLoop(() => {
    const dt = Math.min(0.05, clock.getDelta());
    for (let i = tweens.length - 1; i >= 0; i--) {
      const tw = tweens[i];
      tw.t = Math.min(1, tw.t + dt / 0.55);
      const e = 1 - Math.pow(1 - tw.t, 3);
      tw.item.mesh.position.lerpVectors(tw.from, tw.to, e);
      tw.item.mesh.rotation.y = tw.fromRot + (tw.toRot - tw.fromRot) * e;
      if (tw.t >= 1) { tweens.splice(i, 1); tw.done?.(); }
    }
    if (!reduced) {
      const goal = base.clone().add(new THREE.Vector3(pointer.x * 8, -pointer.y * 5, 0));
      camera.position.lerp(goal, 0.05);
      camera.lookAt(target);
    }
    renderer.render(scene, camera);
  });
  return api;
}

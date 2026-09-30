import { resolveStoryTheme } from './story-model.js';

export const STORY_WIDTH = 1080;
export const STORY_HEIGHT = 1920;
const INK = '#59408D';
const PAPER = '#FBF0D8';
let resourcesPromise;
let grain;

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const timeout = setTimeout(() => { img.src = ''; reject(new Error('Caricamento illustrazioni scaduto')); }, 12000);
    img.onload = () => { clearTimeout(timeout); resolve(img); };
    img.onerror = () => { clearTimeout(timeout); reject(new Error('Illustrazione non disponibile')); };
    img.src = url;
  });
}

export function loadStoryResources() {
  if (!resourcesPromise) {
    resourcesPromise = Promise.all([
      loadImage('/assets/story/bottle.png'), loadImage('/assets/story/glass.png'),
      loadImage('/assets/brand/sovra-naturale-white.png'),
      ...[['StoryDisplay', 'Anton-Regular.ttf'], ['StoryHand', 'Kalam-Regular.ttf']].map(async ([name, file]) => {
        const face = new FontFace(name, `url(/assets/fonts/${file})`);
        let timeout;
        try {
          await Promise.race([face.load(), new Promise((_, reject) => { timeout = setTimeout(() => reject(new Error('Caricamento caratteri scaduto')), 12000); })]);
        } finally { clearTimeout(timeout); }
        document.fonts.add(face);
      })
    ]).then(([bottle, glass, logo]) => ({ bottle, glass, logo })).catch(error => {
      resourcesPromise = null;
      throw error;
    });
  }
  return resourcesPromise;
}

function random(seed) {
  let n = seed >>> 0;
  return () => { n = (Math.imul(1664525, n) + 1013904223) >>> 0; return n / 4294967296; };
}

function tornShape(ctx, vertices, color, seed, roughness = 8) {
  const rand = random(seed);
  ctx.beginPath();
  vertices.forEach(([x, y], i) => {
    const [nx, ny] = vertices[(i + 1) % vertices.length];
    if (i === 0) ctx.moveTo(x, y);
    const steps = Math.ceil(Math.hypot(nx - x, ny - y) / 13);
    for (let j = 1; j <= steps; j++) {
      const t = j / steps;
      ctx.lineTo(x + (nx - x) * t + (rand() - 0.5) * roughness, y + (ny - y) * t + (rand() - 0.5) * roughness);
    }
  });
  ctx.closePath(); ctx.fillStyle = color; ctx.fill();
}

function texture(ctx) {
  if (!grain) {
    grain = document.createElement('canvas'); grain.width = 240; grain.height = 240;
    const c = grain.getContext('2d');
    const pixels = c.createImageData(240, 240); const rand = random(240);
    for (let i = 0; i < pixels.data.length; i += 4) {
      const shade = rand() > 0.45 ? 255 : 88;
      pixels.data[i] = shade; pixels.data[i + 1] = shade; pixels.data[i + 2] = shade;
      pixels.data[i + 3] = Math.floor(rand() * 24);
    }
    c.putImageData(pixels, 0, 0);
  }
  ctx.fillStyle = ctx.createPattern(grain, 'repeat'); ctx.fillRect(0, 0, STORY_WIDTH, STORY_HEIGHT);
}

function fittedText(ctx, text, x, y, maxWidth, size, family, min = 30) {
  let fontSize = size;
  const font = () => { ctx.font = `${fontSize}px ${family}`; };
  font();
  while (ctx.measureText(text).width > maxWidth && fontSize > min) { fontSize -= 1; font(); }
  let visible = text;
  while (ctx.measureText(visible).width > maxWidth && visible.length > 1) visible = visible.slice(0, -2).trimEnd() + '…';
  ctx.fillText(visible, x, y);
}

function illustration(ctx, img, crop, x, y, height, angle) {
  const [sx, sy, sw, sh] = crop; const width = height * sw / sh;
  ctx.save(); ctx.translate(x, y); ctx.rotate(angle * Math.PI / 180);
  ctx.drawImage(img, sx, sy, sw, sh, -width / 2, -height / 2, width, height); ctx.restore();
}

function star(ctx, x, y, size) {
  ctx.beginPath();
  for (let i = 0; i < 16; i++) {
    const a = i * Math.PI / 8; const r = i % 2 ? size * 0.23 : size;
    ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
  }
  ctx.closePath(); ctx.fillStyle = '#FAE8A0'; ctx.fill();
}

function leaves(ctx, x, y, flip = 1) {
  ctx.save(); ctx.translate(x, y); ctx.scale(flip, 1); ctx.strokeStyle = INK; ctx.fillStyle = INK; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.moveTo(0, 110); ctx.bezierCurveTo(-18, 22, 72, -10, 38, -108); ctx.stroke();
  for (let i = 0; i < 5; i++) {
    const yy = 76 - i * 38; const xx = 18 + Math.sin(i) * 17; const direction = i % 2 ? 1 : -1;
    ctx.beginPath(); ctx.moveTo(xx, yy); ctx.quadraticCurveTo(xx + direction * 70, yy - 4, xx + direction * 52, yy - 47);
    ctx.quadraticCurveTo(xx + direction * 5, yy - 43, xx, yy); ctx.fill();
  }
  ctx.restore();
}

function decorations(ctx, decoration, seed) {
  ctx.strokeStyle = INK; ctx.lineWidth = 7; ctx.lineCap = 'round';
  if (decoration === 'leaves') { leaves(ctx, 225, 990); leaves(ctx, 890, 1450, -1); return; }
  if (decoration === 'loops') {
    ctx.beginPath(); ctx.moveTo(-20, 910); ctx.bezierCurveTo(710, 570, 580, 1440, 1070, 1040);
    ctx.bezierCurveTo(1190, 880, 720, 1070, 820, 1470); ctx.stroke(); return;
  }
  star(ctx, 854, 896, decoration === 'stars' ? 100 : 80);
  if (decoration === 'stars') star(ctx, 175, 1405, 46);
  const rand = random(seed);
  for (let i = 0; i < 5; i++) {
    const a = -1.6 + i * 0.55; const x = 160; const y = 1010;
    ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * 50, y + Math.sin(a) * 50);
    ctx.lineTo(x + Math.cos(a) * (86 + rand() * 22), y + Math.sin(a) * (86 + rand() * 22)); ctx.stroke();
  }
}

function sticker(ctx, text, x, y, color, angle, seed) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(angle * Math.PI / 180);
  ctx.font = '55px StoryHand';
  const width = Math.min(390, Math.max(208, ctx.measureText(text).width + 56));
  tornShape(ctx, [[-width / 2, -48], [width / 2, -46], [width / 2 + 2, 47], [-width / 2, 49]], color, seed, 10);
  ctx.fillStyle = INK; ctx.textAlign = 'center';
  fittedText(ctx, text, 0, 21, width - 36, 55, 'StoryHand', 40);
  ctx.restore();
}

/** The preview and PNG use this exact canvas. All text stays separate from the artwork. */
export async function renderStoryCanvas(model, preferences) {
  const assets = await loadStoryResources();
  const canvas = document.createElement('canvas'); canvas.width = STORY_WIDTH; canvas.height = STORY_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Immagini non supportate da questo browser');
  const theme = resolveStoryTheme(model, preferences);
  const seed = model.seed + preferences.variant * 97;
  const offset = (seed % 51) - 25;
  ctx.fillStyle = PAPER; ctx.fillRect(0, 0, STORY_WIDTH, STORY_HEIGHT);
  if (preferences.variant === 0) {
    tornShape(ctx, [[-20, 715 + offset], [730, 965], [885, 1460], [-20, 1580]], theme.colors[0], seed);
    tornShape(ctx, [[-20, 1320], [1100, 770 + offset], [1100, 1640], [270, 1560]], theme.colors[1], seed + 1);
  } else if (preferences.variant === 1) {
    tornShape(ctx, [[-20, 850], [540, 720 + offset], [1050, 1430], [-20, 1640]], theme.colors[0], seed);
    tornShape(ctx, [[620, 810], [1100, 920], [1100, 1570], [420, 1460]], theme.colors[1], seed + 1);
  } else {
    tornShape(ctx, [[-20, 775], [785, 925 + offset], [855, 1450], [-20, 1570]], theme.colors[0], seed);
    tornShape(ctx, [[260, 1100], [1100, 795], [1100, 1610], [235, 1530]], theme.colors[1], seed + 1);
    tornShape(ctx, [[-20, 1400], [630, 1305], [930, 1575], [0, 1600]], theme.sticker, seed + 2);
  }
  texture(ctx);
  decorations(ctx, theme.decoration, seed);

  // White-on-purple brand signature for the exported story.
  ctx.fillStyle = INK; ctx.beginPath(); ctx.ellipse(540, 280, 216, 104, 0, 0, Math.PI * 2); ctx.fill();
  const logoScale = Math.min(344 / assets.logo.naturalWidth, 132 / assets.logo.naturalHeight);
  const logoWidth = assets.logo.naturalWidth * logoScale;
  const logoHeight = assets.logo.naturalHeight * logoScale;
  ctx.drawImage(assets.logo, 540 - logoWidth / 2, 280 - logoHeight / 2, logoWidth, logoHeight);
  ctx.fillStyle = INK; ctx.textAlign = 'center';
  fittedText(ctx, 'Il mio', 540, 494, 850, 106, 'StoryDisplay');
  fittedText(ctx, 'Wine DNA', 540, 624, 890, 138, 'StoryDisplay');
  fittedText(ctx, 'scoperto a Sovra Naturale', 540, 662, 850, 30, 'StoryHand');
  if (preferences.showName && model.name) fittedText(ctx, model.name, 540, 716, 810, 65, 'StoryHand', 34);
  else { ctx.font = '30px StoryHand'; ctx.fillText('Un calice, un ricordo.', 540, 701); }

  const bottleCrop = [203, 10, 575, 1635];
  const glassCrop = [122, 103, 696, 1500];
  if (preferences.variant === 1) {
    illustration(ctx, assets.glass, glassCrop, 299, 1256, 570, -12);
    illustration(ctx, assets.bottle, bottleCrop, 688, 1158, 850, 13);
  } else if (preferences.variant === 2) {
    illustration(ctx, assets.bottle, bottleCrop, 439, 1159, 850, -9);
    illustration(ctx, assets.glass, glassCrop, 752, 1272, 640, 13);
  } else {
    illustration(ctx, assets.bottle, bottleCrop, 407, 1141, 880, -19);
    illustration(ctx, assets.glass, glassCrop, 771, 1250, 645, 15);
  }
  model.emotions.forEach((emotion, i) => sticker(ctx, emotion, i === 0 ? 249 : 821, i === 0 ? 1080 : 1456,
    i === 0 ? theme.sticker : '#F6DEA0', i === 0 ? -10 : 7, seed + i + 8));
  ctx.fillStyle = INK; ctx.textAlign = 'center';
  fittedText(ctx, model.caption, 540, 1684, 914, 43, 'StoryHand', 30);

  if (preferences.showDetails) {
    const labels = [['acidita', 'Acidità'], ['corpo', 'Corpo'], ['persistenza', 'Persistenza']];
    ctx.font = '26px StoryHand';
    labels.forEach(([field, label], i) => {
      const value = model.averages[field];
      ctx.fillText(`${label} ${value === null ? '—' : `${String(value).replace('.', ',')}/5`}`, 235 + i * 305, 1750);
    });
    ctx.font = '22px StoryHand'; ctx.fillText('Intensità medie degli assaggi', 540, 1784);
  } else if (model.count === 1) {
    ctx.font = '27px StoryHand'; ctx.fillText('Il mio primo assaggio', 540, 1742);
  }
  return canvas;
}

export function storyCanvasBlob(canvas) {
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Esportazione immagine non riuscita')), 'image/png'));
}

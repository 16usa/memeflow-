import * as THREE from 'three';

function hex(color) {
  return '#' + Number(color).toString(16).padStart(6, '0');
}

export function chassisMaterial(color, tier = 0, emphasis = 1) {
  const palette = [
    0x010407,
    0x03080d,
    0x071016,
    0x0b151c
  ];

  return new THREE.MeshPhysicalMaterial({
    color: palette[Math.min(tier, palette.length - 1)],
    emissive: color,
    emissiveIntensity:
      (tier === 3 ? 0.035 : tier === 2 ? 0.020 : 0.008)
      * emphasis,
    metalness: 0.91,
    roughness: tier === 3 ? 0.14 : 0.22,
    clearcoat: 1,
    clearcoatRoughness: 0.035
  });
}

export function topGlassMaterial(color, emphasis = 1) {
  return new THREE.MeshPhysicalMaterial({
    color: 0x061018,
    emissive: color,
    emissiveIntensity: 0.075 * emphasis,
    metalness: 0.18,
    roughness: 0.08,
    transmission: 0.08,
    thickness: 0.18,
    clearcoat: 1,
    clearcoatRoughness: 0.02,
    transparent: true,
    opacity: 0.91
  });
}

export function accentMaterial(color, opacity = 0.92) {
  return new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
}

export function lineMaterial(color, opacity = 0.86) {
  return new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
}

export function createBoardTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 2048;
  canvas.height = 2048;

  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#010306';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const grid = 64;

  ctx.lineWidth = 1;

  for (let x = 0; x <= canvas.width; x += grid) {
    ctx.strokeStyle =
      x % (grid * 4) === 0
        ? 'rgba(31,96,135,.18)'
        : 'rgba(20,57,80,.08)';

    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }

  for (let y = 0; y <= canvas.height; y += grid) {
    ctx.strokeStyle =
      y % (grid * 4) === 0
        ? 'rgba(31,96,135,.18)'
        : 'rgba(20,57,80,.08)';

    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }

  // Deterministic pseudo-random PCB traces.
  let seed = 918273;

  function rand() {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  }

  for (let i = 0; i < 330; i++) {
    const x = Math.floor(rand() * 32) * grid;
    const y = Math.floor(rand() * 32) * grid;
    const w = (1 + Math.floor(rand() * 5)) * grid;
    const h = (1 + Math.floor(rand() * 4)) * grid;

    const cyan = rand() > 0.5;

    ctx.strokeStyle =
      cyan
        ? `rgba(22,132,195,${0.05 + rand() * 0.12})`
        : `rgba(29,79,113,${0.04 + rand() * 0.10})`;

    ctx.lineWidth = rand() > 0.75 ? 2 : 1;

    ctx.beginPath();
    ctx.moveTo(x, y);

    if (rand() > 0.5) {
      ctx.lineTo(x + w, y);
      ctx.lineTo(x + w, y + h);
    } else {
      ctx.lineTo(x, y + h);
      ctx.lineTo(x + w, y + h);
    }

    ctx.stroke();

    if (rand() > 0.72) {
      ctx.fillStyle =
        cyan
          ? 'rgba(32,164,234,.20)'
          : 'rgba(45,99,130,.14)';

      ctx.fillRect(
        x - 3,
        y - 3,
        6,
        6
      );
    }
  }

  const vignette = ctx.createRadialGradient(
    1024,
    980,
    120,
    1024,
    980,
    1160
  );

  vignette.addColorStop(0, 'rgba(15,39,52,.06)');
  vignette.addColorStop(0.62, 'rgba(0,0,0,.06)');
  vignette.addColorStop(1, 'rgba(0,0,0,.72)');

  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, 2048, 2048);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.anisotropy = 4;

  return texture;
}

export function createLabelTexture(text, color) {
  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = 220;

  const ctx = canvas.getContext('2d');
  const accent = hex(color);

  const bg = ctx.createLinearGradient(0, 0, 0, canvas.height);
  bg.addColorStop(0, 'rgba(3,7,10,.96)');
  bg.addColorStop(1, 'rgba(0,2,4,.995)');

  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.globalAlpha = 0.25;
  ctx.fillStyle = accent;
  ctx.fillRect(0, 0, 10, canvas.height);
  ctx.globalAlpha = 1;

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#f3f7f9';

  const fontSize =
    text.length > 14
      ? 62
      : text.length > 11
        ? 70
        : 80;

  ctx.font = `800 ${fontSize}px Arial, sans-serif`;

  ctx.shadowColor = accent;
  ctx.shadowBlur = 8;
  ctx.fillText(text, canvas.width / 2, canvas.height / 2 + 2);
  ctx.shadowBlur = 0;

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;

  return texture;
}

export function createIconTexture(kind, color) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;

  const ctx = canvas.getContext('2d');
  const accent = hex(color);

  ctx.translate(256, 256);

  ctx.strokeStyle = accent;
  ctx.fillStyle = accent;
  ctx.lineWidth = 12;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.shadowColor = accent;
  ctx.shadowBlur = 22;

  ctx.globalAlpha = 0.20;
  ctx.beginPath();
  ctx.arc(0, 0, 126, 0, Math.PI * 2);
  ctx.stroke();

  ctx.globalAlpha = 0.95;

  if (kind === 'discovery') {
    ctx.beginPath();
    ctx.arc(-24, -20, 48, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(12, 15);
    ctx.lineTo(80, 82);
    ctx.stroke();
  }

  else if (kind === 'risk') {
    ctx.beginPath();
    ctx.moveTo(0, -92);
    ctx.lineTo(78, -54);
    ctx.lineTo(60, 38);
    ctx.quadraticCurveTo(0, 100, -60, 38);
    ctx.lineTo(-78, -54);
    ctx.closePath();
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(14, -62);
    ctx.lineTo(-34, 7);
    ctx.lineTo(4, 7);
    ctx.lineTo(-12, 63);
    ctx.lineTo(48, -12);
    ctx.lineTo(12, -12);
    ctx.stroke();
  }

  else if (kind === 'core') {
    for (const radius of [34, 70, 108]) {
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(0, 0, 14, 0, Math.PI * 2);
    ctx.fill();
  }

  else if (kind === 'bootstrap') {
    ctx.beginPath();
    ctx.arc(0, 0, 80, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, 28, 0, Math.PI * 2);
    ctx.stroke();
  }

  else if (kind === 'openai') {
    for (let i = 0; i < 6; i++) {
      ctx.save();
      ctx.rotate(i * Math.PI / 3);
      ctx.beginPath();
      ctx.ellipse(0, -47, 31, 61, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  else if (kind === 'decision') {
    ctx.beginPath();
    ctx.arc(0, 0, 88, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, 28, 0, Math.PI * 2);
    ctx.fill();
    for (const [x1, y1, x2, y2] of [
      [0, -116, 0, -82],
      [0, 82, 0, 116],
      [-116, 0, -82, 0],
      [82, 0, 116, 0]
    ]) {
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
  }

  else if (kind === 'market') {
    for (let i = 0; i < 9; i++) {
      const angle = (i / 9) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(
        Math.cos(angle) * 58,
        Math.sin(angle) * 58,
        26,
        0,
        Math.PI * 2
      );
      ctx.stroke();
    }
  }

  else if (kind === 'paper') {
    ctx.beginPath();
    ctx.moveTo(-80, 55);
    ctx.lineTo(-15, -46);
    ctx.lineTo(24, -3);
    ctx.lineTo(82, -86);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(82, -86);
    ctx.lineTo(76, -30);
    ctx.moveTo(82, -86);
    ctx.lineTo(26, -78);
    ctx.stroke();
  }

  else if (kind === 'execution') {
    ctx.beginPath();
    ctx.arc(0, 0, 88, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(18, -92);
    ctx.lineTo(-42, 0);
    ctx.lineTo(4, 0);
    ctx.lineTo(-16, 88);
    ctx.lineTo(62, -18);
    ctx.lineTo(12, -18);
    ctx.closePath();
    ctx.fill();
  }

  else if (kind === 'holders') {
    const pts = [
      [0, -70],
      [-62, 42],
      [62, 42]
    ];

    for (const [x, y] of pts) {
      ctx.beginPath();
      ctx.arc(x, y, 22, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.beginPath();
    ctx.moveTo(0, -48);
    ctx.lineTo(-45, 26);
    ctx.moveTo(0, -48);
    ctx.lineTo(45, 26);
    ctx.moveTo(-40, 42);
    ctx.lineTo(40, 42);
    ctx.stroke();
  }

  ctx.shadowBlur = 0;

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;

  return texture;
}

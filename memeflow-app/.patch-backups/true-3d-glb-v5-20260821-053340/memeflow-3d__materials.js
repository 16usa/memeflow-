import * as THREE from 'three';

function hex(color) {
  return '#' + Number(color).toString(16).padStart(6, '0');
}

function makeRadialTexture(size = 256) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;

  const ctx = canvas.getContext('2d');

  const g = ctx.createRadialGradient(
    size / 2,
    size / 2,
    4,
    size / 2,
    size / 2,
    size * 0.48
  );

  g.addColorStop(0.00, 'rgba(255,255,255,0.96)');
  g.addColorStop(0.16, 'rgba(255,255,255,0.48)');
  g.addColorStop(0.48, 'rgba(255,255,255,0.13)');
  g.addColorStop(1.00, 'rgba(255,255,255,0)');

  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;

  return texture;
}

export const SOFT_GLOW = makeRadialTexture();

export function chassisMaterial(color, tier = 0, emphasis = 1) {
  const isTop = tier === 2;

  return new THREE.MeshPhysicalMaterial({
    color:
      isTop
        ? 0x06131b
        : tier === 1
          ? 0x030b10
          : 0x02070a,

    emissive: color,

    emissiveIntensity:
      (isTop ? 0.085 : tier === 1 ? 0.032 : 0.012)
      * emphasis,

    metalness:
      isTop ? 0.48 : 0.70,

    roughness:
      isTop ? 0.17 : 0.25,

    clearcoat: 1,
    clearcoatRoughness: 0.055,

    transparent: true,
    opacity: isTop ? 0.985 : 1
  });
}

export function glassMaterial(color, emphasis = 1) {
  return new THREE.MeshPhysicalMaterial({
    color: 0x071720,
    emissive: color,
    emissiveIntensity: 0.16 * emphasis,

    metalness: 0.08,
    roughness: 0.09,

    transmission: 0.18,
    thickness: 0.28,
    ior: 1.35,

    clearcoat: 1,
    clearcoatRoughness: 0.02,

    transparent: true,
    opacity: 0.72
  });
}

export function edgeMaterial(color, opacity = 0.72) {
  return new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
}

export function glowPlane(width, depth, color, opacity = 0.16) {
  const plane = new THREE.Mesh(
    new THREE.PlaneGeometry(width, depth),
    new THREE.MeshBasicMaterial({
      map: SOFT_GLOW,
      color,
      transparent: true,
      opacity,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide
    })
  );

  plane.rotation.x = -Math.PI / 2;

  return plane;
}

export function conduitMaterial(color, opacity = 0.8) {
  return new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
}

export function labelTexture(text, color) {
  const canvas = document.createElement('canvas');

  canvas.width = 1024;
  canvas.height = 220;

  const ctx = canvas.getContext('2d');
  const accent = hex(color);

  const bg = ctx.createLinearGradient(
    0,
    0,
    0,
    canvas.height
  );

  bg.addColorStop(0, 'rgba(7,12,17,.98)');
  bg.addColorStop(1, 'rgba(2,5,8,.98)');

  ctx.fillStyle = bg;
  ctx.fillRect(
    0,
    0,
    canvas.width,
    canvas.height
  );

  ctx.strokeStyle = accent;
  ctx.globalAlpha = 0.68;
  ctx.lineWidth = 4;

  ctx.strokeRect(
    8,
    8,
    canvas.width - 16,
    canvas.height - 16
  );

  ctx.globalAlpha = 1;

  ctx.fillStyle = '#f2f7fa';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.shadowColor = accent;
  ctx.shadowBlur = 14;

  const fontSize =
    text.length > 15
      ? 56
      : text.length > 11
        ? 64
        : 72;

  ctx.font =
    `800 ${fontSize}px Arial, sans-serif`;

  ctx.fillText(
    text,
    canvas.width / 2,
    canvas.height / 2
  );

  ctx.shadowBlur = 0;

  const texture =
    new THREE.CanvasTexture(canvas);

  texture.colorSpace =
    THREE.SRGBColorSpace;

  return texture;
}

export function iconTexture(kind, color) {
  const canvas =
    document.createElement('canvas');

  canvas.width = 512;
  canvas.height = 512;

  const ctx =
    canvas.getContext('2d');

  const accent = hex(color);

  ctx.clearRect(
    0,
    0,
    canvas.width,
    canvas.height
  );

  ctx.translate(
    canvas.width / 2,
    canvas.height / 2
  );

  ctx.strokeStyle = accent;
  ctx.fillStyle = accent;
  ctx.lineWidth = 12;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  ctx.shadowColor = accent;
  ctx.shadowBlur = 24;

  ctx.globalAlpha = 0.28;
  ctx.beginPath();
  ctx.arc(0, 0, 136, 0, Math.PI * 2);
  ctx.stroke();

  ctx.globalAlpha = 0.72;
  ctx.beginPath();
  ctx.arc(0, 0, 96, 0, Math.PI * 2);
  ctx.stroke();

  ctx.globalAlpha = 1;

  if (kind === 'discovery') {
    ctx.beginPath();
    ctx.arc(-24, -20, 48, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(12, 16);
    ctx.lineTo(76, 82);
    ctx.stroke();
  }

  else if (kind === 'bootstrap') {
    ctx.beginPath();
    ctx.moveTo(18, -98);
    ctx.lineTo(-48, 6);
    ctx.lineTo(4, 6);
    ctx.lineTo(-20, 96);
    ctx.lineTo(68, -20);
    ctx.lineTo(10, -20);
    ctx.closePath();
    ctx.stroke();
  }

  else if (kind === 'core') {
    for (const radius of [36, 74, 118]) {
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.beginPath();
    ctx.arc(0, 0, 14, 0, Math.PI * 2);
    ctx.fill();
  }

  else if (kind === 'risk') {
    ctx.beginPath();
    ctx.moveTo(0, -92);
    ctx.lineTo(76, -55);
    ctx.lineTo(60, 38);
    ctx.quadraticCurveTo(0, 100, -60, 38);
    ctx.lineTo(-76, -55);
    ctx.closePath();
    ctx.stroke();
  }

  else if (kind === 'market') {
    ctx.beginPath();
    ctx.moveTo(-88, 56);
    ctx.lineTo(-30, 10);
    ctx.lineTo(10, 34);
    ctx.lineTo(82, -70);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(82, -70);
    ctx.lineTo(78, -8);
    ctx.moveTo(82, -70);
    ctx.lineTo(22, -64);
    ctx.stroke();
  }

  else if (kind === 'holders') {
    const points = [
      [0, -76],
      [-70, 44],
      [70, 44]
    ];

    for (const [x, y] of points) {
      ctx.beginPath();
      ctx.arc(x, y, 23, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.beginPath();
    ctx.moveTo(0, -52);
    ctx.lineTo(-52, 26);
    ctx.moveTo(0, -52);
    ctx.lineTo(52, 26);
    ctx.moveTo(-47, 44);
    ctx.lineTo(47, 44);
    ctx.stroke();
  }

  else if (kind === 'openai') {
    for (let i = 0; i < 6; i++) {
      ctx.save();
      ctx.rotate(i * Math.PI / 3);
      ctx.beginPath();
      ctx.ellipse(0, -52, 34, 66, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  else if (kind === 'decision') {
    ctx.beginPath();
    ctx.arc(0, 0, 76, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(-14, -54);
    ctx.lineTo(20, -20);
    ctx.lineTo(-10, 14);
    ctx.lineTo(30, 58);
    ctx.stroke();
  }

  else if (kind === 'paper') {
    ctx.strokeRect(
      -66,
      -92,
      132,
      184
    );

    for (const y of [-44, 0, 44]) {
      ctx.beginPath();
      ctx.moveTo(-36, y);
      ctx.lineTo(36, y);
      ctx.stroke();
    }
  }

  else if (kind === 'execution') {
    ctx.beginPath();
    ctx.arc(0, 0, 86, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(0, 0, 24, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(0, -120);
    ctx.lineTo(0, -84);
    ctx.moveTo(0, 84);
    ctx.lineTo(0, 120);
    ctx.moveTo(-120, 0);
    ctx.lineTo(-84, 0);
    ctx.moveTo(84, 0);
    ctx.lineTo(120, 0);
    ctx.stroke();
  }

  ctx.shadowBlur = 0;

  const texture =
    new THREE.CanvasTexture(canvas);

  texture.colorSpace =
    THREE.SRGBColorSpace;

  return texture;
}

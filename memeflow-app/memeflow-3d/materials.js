import * as THREE from 'three';

function hex(color) {
  return '#' + Number(color).toString(16).padStart(6, '0');
}

function radialTexture(size = 256) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;

  const ctx = canvas.getContext('2d');

  const gradient = ctx.createRadialGradient(
    size / 2,
    size / 2,
    4,
    size / 2,
    size / 2,
    size * 0.48
  );

  gradient.addColorStop(0.00, 'rgba(255,255,255,.92)');
  gradient.addColorStop(0.16, 'rgba(255,255,255,.42)');
  gradient.addColorStop(0.48, 'rgba(255,255,255,.10)');
  gradient.addColorStop(1.00, 'rgba(255,255,255,0)');

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;

  return texture;
}

export const SOFT_GLOW = radialTexture();

export function chassisMaterial(color, tier = 0, emphasis = 1) {
  const top = tier === 2;

  return new THREE.MeshPhysicalMaterial({
    color:
      top
        ? 0x06121a
        : tier === 1
          ? 0x03090e
          : 0x010508,

    emissive: color,

    emissiveIntensity:
      (top ? 0.045 : tier === 1 ? 0.018 : 0.007)
      * emphasis,

    metalness: top ? 0.64 : 0.78,
    roughness: top ? 0.18 : 0.26,

    clearcoat: 1,
    clearcoatRoughness: 0.045
  });
}

export function glassMaterial(color, emphasis = 1) {
  return new THREE.MeshPhysicalMaterial({
    color: 0x06131b,
    emissive: color,
    emissiveIntensity: 0.095 * emphasis,

    metalness: 0.10,
    roughness: 0.08,

    transmission: 0.26,
    thickness: 0.24,
    ior: 1.32,

    clearcoat: 1,
    clearcoatRoughness: 0.02,

    transparent: true,
    opacity: 0.74
  });
}

export function metalDetailMaterial(color, emphasis = 1) {
  return new THREE.MeshStandardMaterial({
    color: 0x0a141a,
    emissive: color,
    emissiveIntensity: 0.045 * emphasis,
    metalness: 0.90,
    roughness: 0.19
  });
}

export function silverMaterial(color) {
  return new THREE.MeshStandardMaterial({
    color: 0x8da1ad,
    emissive: color,
    emissiveIntensity: 0.035,
    metalness: 0.96,
    roughness: 0.16
  });
}

export function edgeMaterial(color, opacity = 0.55) {
  return new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
}

export function glowPlane(width, depth, color, opacity = 0.10) {
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

export function labelTexture(text, color) {
  const canvas = document.createElement('canvas');

  canvas.width = 1024;
  canvas.height = 210;

  const ctx = canvas.getContext('2d');
  const accent = hex(color);

  const bg = ctx.createLinearGradient(0, 0, 0, canvas.height);
  bg.addColorStop(0, 'rgba(5,10,14,.96)');
  bg.addColorStop(1, 'rgba(1,4,6,.99)');

  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = accent;
  ctx.globalAlpha = 0.42;
  ctx.lineWidth = 3;
  ctx.strokeRect(7, 7, canvas.width - 14, canvas.height - 14);
  ctx.globalAlpha = 1;

  ctx.fillStyle = '#eef5f8';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.shadowColor = accent;
  ctx.shadowBlur = 9;

  const fontSize =
    text.length > 15
      ? 58
      : text.length > 11
        ? 66
        : 76;

  ctx.font = `800 ${fontSize}px Arial, sans-serif`;
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);

  ctx.shadowBlur = 0;

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;

  return texture;
}

export function iconTexture(kind, color) {
  const canvas = document.createElement('canvas');

  canvas.width = 512;
  canvas.height = 512;

  const ctx = canvas.getContext('2d');
  const accent = hex(color);

  ctx.translate(256, 256);

  ctx.strokeStyle = accent;
  ctx.fillStyle = accent;
  ctx.lineWidth = 11;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  ctx.shadowColor = accent;
  ctx.shadowBlur = 18;

  ctx.globalAlpha = 0.20;
  ctx.beginPath();
  ctx.arc(0, 0, 132, 0, Math.PI * 2);
  ctx.stroke();

  ctx.globalAlpha = 0.62;
  ctx.beginPath();
  ctx.arc(0, 0, 92, 0, Math.PI * 2);
  ctx.stroke();

  ctx.globalAlpha = 1;

  if (kind === 'discovery') {
    ctx.beginPath();
    ctx.arc(-22, -20, 45, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(10, 14);
    ctx.lineTo(70, 76);
    ctx.stroke();
  }

  else if (kind === 'bootstrap') {
    ctx.beginPath();
    ctx.moveTo(18, -92);
    ctx.lineTo(-44, 4);
    ctx.lineTo(3, 4);
    ctx.lineTo(-18, 88);
    ctx.lineTo(62, -18);
    ctx.lineTo(10, -18);
    ctx.closePath();
    ctx.stroke();
  }

  else if (kind === 'core') {
    for (const radius of [34, 70, 112]) {
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.beginPath();
    ctx.arc(0, 0, 13, 0, Math.PI * 2);
    ctx.fill();
  }

  else if (kind === 'risk') {
    ctx.beginPath();
    ctx.moveTo(0, -88);
    ctx.lineTo(72, -52);
    ctx.lineTo(56, 35);
    ctx.quadraticCurveTo(0, 94, -56, 35);
    ctx.lineTo(-72, -52);
    ctx.closePath();
    ctx.stroke();
  }

  else if (kind === 'market') {
    ctx.beginPath();
    ctx.moveTo(-82, 52);
    ctx.lineTo(-28, 9);
    ctx.lineTo(8, 31);
    ctx.lineTo(76, -64);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(76, -64);
    ctx.lineTo(72, -9);
    ctx.moveTo(76, -64);
    ctx.lineTo(22, -58);
    ctx.stroke();
  }

  else if (kind === 'holders') {
    const points = [
      [0, -70],
      [-64, 40],
      [64, 40]
    ];

    for (const [x, y] of points) {
      ctx.beginPath();
      ctx.arc(x, y, 21, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.beginPath();
    ctx.moveTo(0, -48);
    ctx.lineTo(-46, 24);
    ctx.moveTo(0, -48);
    ctx.lineTo(46, 24);
    ctx.moveTo(-42, 40);
    ctx.lineTo(42, 40);
    ctx.stroke();
  }

  else if (kind === 'openai') {
    for (let i = 0; i < 6; i++) {
      ctx.save();
      ctx.rotate(i * Math.PI / 3);
      ctx.beginPath();
      ctx.ellipse(0, -48, 31, 60, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  else if (kind === 'decision') {
    ctx.beginPath();
    ctx.arc(0, 0, 72, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(-12, -50);
    ctx.lineTo(18, -18);
    ctx.lineTo(-8, 12);
    ctx.lineTo(27, 54);
    ctx.stroke();
  }

  else if (kind === 'paper') {
    ctx.strokeRect(-60, -84, 120, 168);

    for (const y of [-40, 0, 40]) {
      ctx.beginPath();
      ctx.moveTo(-32, y);
      ctx.lineTo(32, y);
      ctx.stroke();
    }
  }

  else if (kind === 'execution') {
    ctx.beginPath();
    ctx.arc(0, 0, 78, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(0, 0, 22, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(0, -112);
    ctx.lineTo(0, -78);
    ctx.moveTo(0, 78);
    ctx.lineTo(0, 112);
    ctx.moveTo(-112, 0);
    ctx.lineTo(-78, 0);
    ctx.moveTo(78, 0);
    ctx.lineTo(112, 0);
    ctx.stroke();
  }

  ctx.shadowBlur = 0;

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;

  return texture;
}

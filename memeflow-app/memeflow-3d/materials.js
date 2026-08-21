import * as THREE from 'three';

export function metalMaterial(color, intensity = 0.035) {
  return new THREE.MeshPhysicalMaterial({
    color: 0x050b10,
    emissive: color,
    emissiveIntensity: intensity,
    metalness: 0.88,
    roughness: 0.22,
    clearcoat: 1,
    clearcoatRoughness: 0.07
  });
}

export function darkMetal() {
  return new THREE.MeshPhysicalMaterial({
    color: 0x03070a,
    metalness: 0.93,
    roughness: 0.25,
    clearcoat: 0.72,
    clearcoatRoughness: 0.11
  });
}

export function glassMaterial(color) {
  return new THREE.MeshPhysicalMaterial({
    color: 0x061018,
    emissive: color,
    emissiveIntensity: 0.08,
    metalness: 0.08,
    roughness: 0.08,
    transmission: 0.20,
    thickness: 0.20,
    ior: 1.34,
    clearcoat: 1,
    clearcoatRoughness: 0.02,
    transparent: true,
    opacity: 0.82
  });
}

export function additive(color, opacity = 0.55) {
  return new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
}

export function lineMaterial(color, opacity = 0.45) {
  return new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
}

function hex(color) {
  return '#' + Number(color).toString(16).padStart(6, '0');
}

export function textTexture(
  text,
  color = 0xffffff,
  {
    width = 1024,
    height = 256,
    fontSize = 72,
    weight = 760,
    background = 'rgba(2,5,8,.88)',
    border = true,
    glow = 6
  } = {}
) {
  const canvas = document.createElement('canvas');

  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  const accent = hex(color);

  ctx.clearRect(0, 0, width, height);

  if (background) {
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, background);
    gradient.addColorStop(1, 'rgba(0,2,4,.95)');

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
  }

  if (border) {
    ctx.globalAlpha = .42;
    ctx.strokeStyle = accent;
    ctx.lineWidth = 3;
    ctx.strokeRect(5, 5, width - 10, height - 10);
    ctx.globalAlpha = 1;
  }

  ctx.fillStyle = '#eef5f7';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.shadowColor = accent;
  ctx.shadowBlur = glow;

  ctx.font =
    `${weight} ${fontSize}px Inter, Arial, sans-serif`;

  ctx.fillText(
    text,
    width / 2,
    height / 2
  );

  ctx.shadowBlur = 0;

  const texture =
    new THREE.CanvasTexture(canvas);

  texture.colorSpace =
    THREE.SRGBColorSpace;

  texture.needsUpdate = true;

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

  ctx.translate(256, 256);

  ctx.strokeStyle = accent;
  ctx.fillStyle = accent;
  ctx.lineWidth = 11;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  ctx.shadowColor = accent;
  ctx.shadowBlur = 16;

  ctx.globalAlpha = .35;

  ctx.beginPath();
  ctx.arc(0, 0, 106, 0, Math.PI * 2);
  ctx.stroke();

  ctx.globalAlpha = 1;

  if (kind === 'discovery') {
    ctx.beginPath();
    ctx.arc(-20, -18, 44, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(12, 14);
    ctx.lineTo(72, 76);
    ctx.stroke();
  }

  else if (kind === 'bootstrap') {
    ctx.beginPath();
    ctx.moveTo(20, -90);
    ctx.lineTo(-42, 2);
    ctx.lineTo(3, 2);
    ctx.lineTo(-16, 86);
    ctx.lineTo(64, -16);
    ctx.lineTo(10, -16);
    ctx.closePath();
    ctx.stroke();
  }

  else if (kind === 'risk') {
    ctx.beginPath();
    ctx.moveTo(0, -82);
    ctx.lineTo(68, -49);
    ctx.lineTo(52, 34);
    ctx.quadraticCurveTo(0, 90, -52, 34);
    ctx.lineTo(-68, -49);
    ctx.closePath();
    ctx.stroke();
  }

  else if (kind === 'market') {
    ctx.beginPath();
    ctx.moveTo(-76, 55);
    ctx.lineTo(-34, 9);
    ctx.lineTo(-4, 31);
    ctx.lineTo(30, -20);
    ctx.lineTo(72, -68);
    ctx.stroke();
  }

  else if (kind === 'holders') {
    ctx.beginPath();
    ctx.arc(0, -35, 34, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(0, 46, 62, Math.PI, Math.PI * 2);
    ctx.stroke();
  }

  else if (kind === 'openai') {
    for (let i = 0; i < 6; i++) {
      ctx.save();
      ctx.rotate(i * Math.PI / 3);
      ctx.beginPath();
      ctx.ellipse(0, -45, 28, 57, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  else if (kind === 'decision') {
    ctx.beginPath();
    ctx.arc(0, 0, 76, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(-16, -50);
    ctx.lineTo(16, -18);
    ctx.lineTo(-10, 12);
    ctx.lineTo(28, 54);
    ctx.stroke();
  }

  else if (kind === 'paper') {
    ctx.strokeRect(-60, -80, 120, 160);

    for (const y of [-38, 0, 38]) {
      ctx.beginPath();
      ctx.moveTo(-30, y);
      ctx.lineTo(30, y);
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

    for (const [x1, y1, x2, y2] of [
      [0, -110, 0, -76],
      [0, 76, 0, 110],
      [-110, 0, -76, 0],
      [76, 0, 110, 0]
    ]) {
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
  }

  else if (kind === 'core') {
    for (const radius of [28, 60, 94]) {
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  ctx.shadowBlur = 0;

  const texture =
    new THREE.CanvasTexture(canvas);

  texture.colorSpace =
    THREE.SRGBColorSpace;

  return texture;
}

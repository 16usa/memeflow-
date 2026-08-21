import * as THREE from 'three';

export function roundedGlowTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(128, 128, 8, 128, 128, 120);
  g.addColorStop(0.00, 'rgba(255,255,255,0.95)');
  g.addColorStop(0.18, 'rgba(255,255,255,0.50)');
  g.addColorStop(0.48, 'rgba(255,255,255,0.16)');
  g.addColorStop(1.00, 'rgba(255,255,255,0.00)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export const GLOW_TEXTURE = roundedGlowTexture();

export function glowPlane(width, depth, color, opacity=0.2) {
  const plane = new THREE.Mesh(
    new THREE.PlaneGeometry(width, depth),
    new THREE.MeshBasicMaterial({
      map: GLOW_TEXTURE,
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

export function shellMaterial(color, top=false) {
  return new THREE.MeshPhysicalMaterial({
    color: top ? 0x071622 : 0x04090d,
    emissive: color,
    emissiveIntensity: top ? 0.28 : 0.08,
    metalness: top ? 0.28 : 0.62,
    roughness: top ? 0.14 : 0.24,
    clearcoat: 1,
    clearcoatRoughness: 0.05,
    transparent: true,
    opacity: top ? 0.76 : 0.98
  });
}

export function edgeMaterial(color, opacity=0.75) {
  return new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
}

export function lineMaterial(color, opacity=0.85) {
  return new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
}

export function labelTexture(text, accent) {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 220;
  const ctx = c.getContext('2d');

  const bg = ctx.createLinearGradient(0, 0, 0, 220);
  bg.addColorStop(0, 'rgba(7,12,18,0.98)');
  bg.addColorStop(1, 'rgba(2,5,8,0.98)');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 1024, 220);

  ctx.strokeStyle = '#' + accent.toString(16).padStart(6, '0');
  ctx.lineWidth = 6;
  ctx.globalAlpha = 0.9;
  ctx.strokeRect(8, 8, 1008, 204);
  ctx.globalAlpha = 1;

  ctx.fillStyle = '#f4f8fb';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = '#' + accent.toString(16).padStart(6, '0');
  ctx.shadowBlur = 18;
  const fontSize = text.length > 14 ? 58 : text.length > 11 ? 66 : 74;
  ctx.font = `800 ${fontSize}px Arial`;
  ctx.fillText(text, 512, 110);

  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function iconTexture(symbol, accent) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, 512, 512);

  ctx.strokeStyle = '#' + accent.toString(16).padStart(6, '0');
  ctx.lineWidth = 12;
  ctx.globalAlpha = 0.75;
  ctx.beginPath();
  ctx.arc(256, 230, 100, 0, Math.PI * 2);
  ctx.stroke();

  ctx.globalAlpha = 1;
  ctx.fillStyle = '#eef7ff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = '#' + accent.toString(16).padStart(6, '0');
  ctx.shadowBlur = 20;
  ctx.font = '700 140px Arial';
  ctx.fillText(symbol, 256, 235);

  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

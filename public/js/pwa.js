let deferred = null;
const listeners = new Set();

export function isStandalone() {
  return matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
}

export function isIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

export function canPrompt() {
  return !!deferred;
}

export function onInstallChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

const notify = () => listeners.forEach((fn) => fn());

export async function promptInstall() {
  if (!deferred) return false;
  deferred.prompt();
  const { outcome } = await deferred.userChoice;
  deferred = null;
  notify();
  return outcome === 'accepted';
}

export function initPWA({ onUpdate } = {}) {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    notify();
  });
  if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (hadController) onUpdate?.();
  });
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}

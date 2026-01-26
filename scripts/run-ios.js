#!/usr/bin/env node
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

function run(command, args) {
  const result = spawnSync(command, args, { stdio: 'inherit' });
  process.exit(result.status ?? 1);
}

function tryReadJson(command, args) {
  const result = spawnSync(command, args, { encoding: 'utf8' });
  if (result.status !== 0) return null;
  try {
    return JSON.parse(result.stdout);
  } catch {
    return null;
  }
}

function parseRuntimeVersion(runtimeKey) {
  const match = runtimeKey.match(/iOS-(\\d+)-(\\d+)/);
  if (!match) return null;
  return { major: Number(match[1]), minor: Number(match[2]) };
}

function compareRuntime(a, b) {
  if (a.major !== b.major) return a.major - b.major;
  return a.minor - b.minor;
}

function pickPreferredIPhone(devices) {
  const preferences = [
    /^iPhone \\d+ Pro Max$/,
    /^iPhone \\d+ Pro$/,
    /^iPhone \\d+$/,
    /^iPhone \\d+e$/,
    /^iPhone Air$/,
    /^iPhone/,
  ];

  for (const pattern of preferences) {
    const match = devices.find((d) => pattern.test(d.name));
    if (match) return match;
  }

  return devices[0] ?? null;
}

function resolveReactNativeBin() {
  const local = path.resolve(__dirname, '..', 'node_modules', '.bin', 'react-native');
  if (fs.existsSync(local)) return local;
  return null;
}

const passthroughArgs = process.argv.slice(2);
const userSpecifiedDevice =
  passthroughArgs.includes('--udid') ||
  passthroughArgs.includes('--simulator') ||
  passthroughArgs.includes('--device') ||
  passthroughArgs.includes('--destination') ||
  passthroughArgs.includes('--list-devices');

const reactNativeBin = resolveReactNativeBin();
if (!reactNativeBin) {
  run('npx', ['react-native', 'run-ios', ...passthroughArgs]);
}

if (userSpecifiedDevice) {
  run(reactNativeBin, ['run-ios', ...passthroughArgs]);
}

const simctlJson = tryReadJson('xcrun', ['simctl', 'list', 'devices', 'available', '-j']);
const allDevices = simctlJson?.devices ?? null;
if (!allDevices || typeof allDevices !== 'object') {
  run(reactNativeBin, ['run-ios', ...passthroughArgs]);
}

const iosRuntimes = Object.entries(allDevices)
  .map(([runtimeKey, devices]) => ({
    runtimeKey,
    version: parseRuntimeVersion(runtimeKey),
    devices: Array.isArray(devices) ? devices : [],
  }))
  .filter((r) => r.version && r.devices.length > 0)
  .sort((a, b) => compareRuntime(a.version, b.version));

const newest = iosRuntimes.at(-1);
const iPhones = (newest?.devices ?? []).filter(
  (d) => d && d.isAvailable && typeof d.name === 'string' && d.name.startsWith('iPhone'),
);

const chosen = pickPreferredIPhone(iPhones);
if (!chosen?.udid) {
  run(reactNativeBin, ['run-ios', ...passthroughArgs]);
}

run(reactNativeBin, ['run-ios', '--udid', chosen.udid, ...passthroughArgs]);

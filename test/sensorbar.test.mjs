import { SensorBar } from '../src/input/sensorbar/SensorBar.ts';

console.log('--- Running SensorBar Unit Tests ---');
let passed = true;

const sensorBar = new SensorBar(1.0);

// Test 1: First packet auto-centers pointer at (0.5, 0.5)
const initialPacket = {
  t: 1000,
  orientation: { alpha: 180, beta: 20, gamma: 0 },
  rotationRate: { alpha: 0, beta: 0, gamma: 0 },
  accel: { x: 0, y: 0, z: 0 },
  buttons: 0
};

const state1 = sensorBar.update(initialPacket);
if (Math.abs(state1.pointer.x - 0.5) > 0.001 || Math.abs(state1.pointer.y - 0.5) > 0.001) {
  console.error('FAIL: Initial packet should place pointer at screen center (0.5, 0.5)', state1.pointer);
  passed = false;
} else {
  console.log('PASS: Initial packet auto-centered at (0.5, 0.5)');
}

// Test 2: Aiming Right (Yaw increases from 180 to 200 degrees)
let stateCurrent = state1;
for (let i = 1; i <= 30; i++) {
  const packet = {
    t: 1000 + i * 16.6,
    orientation: { alpha: 180 + (20 * i) / 30, beta: 20, gamma: 0 },
    rotationRate: { alpha: 20, beta: 0, gamma: 0 },
    accel: { x: 0, y: 0, z: 0 },
    buttons: 0
  };
  stateCurrent = sensorBar.update(packet);
}

if (stateCurrent.pointer.x <= 0.5) {
  console.error('FAIL: Aiming right should increase pointer.x > 0.5', stateCurrent.pointer.x);
  passed = false;
} else {
  console.log(`PASS: Aiming right moved pointer.x to ${stateCurrent.pointer.x.toFixed(3)}`);
}

// Test 3: Recenter restores center to current aim
sensorBar.recenter();
const recenteredState = sensorBar.getState();
if (Math.abs(recenteredState.pointer.x - 0.5) > 0.001) {
  console.error('FAIL: Recenter should place pointer back to (0.5, 0.5)', recenteredState.pointer);
  passed = false;
} else {
  console.log('PASS: Recenter reset pointer to (0.5, 0.5)');
}

// Test 4: Screen Clamping (Aiming way off screen)
const extremePacket = {
  t: 2000,
  orientation: { alpha: 350, beta: -80, gamma: 0 },
  rotationRate: { alpha: 0, beta: 0, gamma: 0 },
  buttons: 0
};
for (let i = 0; i < 20; i++) {
  stateCurrent = sensorBar.update({ ...extremePacket, t: 2000 + i * 16.6 });
}

if (stateCurrent.pointer.x < 0.0 || stateCurrent.pointer.x > 1.0 || stateCurrent.pointer.y < 0.0 || stateCurrent.pointer.y > 1.0) {
  console.error('FAIL: Pointer coordinates should be clamped to [0.0, 1.0]', stateCurrent.pointer);
  passed = false;
} else {
  console.log('PASS: Extreme angles clamped cleanly to [0.0, 1.0]');
}

// Test 5: Dead Zone Filtering
const stillPoint = { ...stateCurrent.pointer };
const microJitterPacket = {
  t: 2500,
  orientation: { alpha: 350.01, beta: -80.01, gamma: 0 },
  rotationRate: { alpha: 0, beta: 0, gamma: 0 },
  buttons: 0
};
const jitterState = sensorBar.update(microJitterPacket);
if (Math.abs(jitterState.pointer.x - stillPoint.x) > 0.005) {
  console.error('FAIL: Micro-jitter should be suppressed by dead zone');
  passed = false;
} else {
  console.log('PASS: Dead zone suppresses micro-jitter when holding still');
}

console.log('--- All SensorBar Tests Completed ---');
process.exit(passed ? 0 : 1);

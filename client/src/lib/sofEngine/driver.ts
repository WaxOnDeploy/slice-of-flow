import { advanceTo, applyAction, validateEngine } from './engine';
import {
  exactKeys, failure, immutable, isCode, isRecord, isTime, success, validateCommand,
  type Checked, type Driver, type DriverStep, type Engine,
} from './types';

export function createDriver(runId: unknown): Checked<Driver> {
  if (!isCode(runId) || runId.length > 64) return failure('INVALID_ID', 'runId');
  return success(immutable({ runId, lastWallUs: null, remainderUs: 0 }));
}
function validateDriver(driver: unknown, runId: string): Checked<Driver> {
  if (!isRecord(driver) || !exactKeys(driver, ['runId', 'lastWallUs', 'remainderUs']) || driver.runId !== runId ||
    (driver.lastWallUs !== null && !isTime(driver.lastWallUs)) || !isTime(driver.remainderUs) || driver.remainderUs >= 1000) return failure('INVALID_DRIVER', 'driver');
  return success(driver as Driver);
}
/** Rebase while preserving fractional simulated milliseconds. No elapsed time is credited. */
export function rebaseDriver(driver: unknown, wallUs: unknown): Checked<Driver> {
  if (!isRecord(driver) || !isCode(driver.runId)) return failure('INVALID_DRIVER', 'driver');
  const valid = validateDriver(driver, driver.runId); if (!valid.ok) return valid;
  if (!isTime(wallUs) || (valid.value.lastWallUs !== null && wallUs < valid.value.lastWallUs)) return failure('INVALID_WALL_TIME', 'wallUs');
  return success(immutable({ ...valid.value, lastWallUs: wallUs }));
}
/** First sample anchors. Paused/ended samples update only the anchor; hidden is an owned pause. */
export function sampleWall(state: Engine, input: unknown, wallUs: unknown): Checked<DriverStep> {
  const engine = validateEngine(state); if (!engine.ok) return engine;
  const checked = validateDriver(input, state.runId); if (!checked.ok) return checked;
  const driver = checked.value;
  if (!isTime(wallUs) || (driver.lastWallUs !== null && wallUs < driver.lastWallUs)) return failure('INVALID_WALL_TIME', 'wallUs');
  const delta = driver.lastWallUs === null ? 0 : wallUs - driver.lastWallUs;
  if (state.pausedBy.length || state.ended) return success(Object.freeze({ state, emitted: Object.freeze([]), driver: immutable({ ...driver, lastWallUs: wallUs }) }));
  const total = delta * state.speed + driver.remainderUs;
  if (!Number.isSafeInteger(total) || !Number.isSafeInteger(state.nowMs + Math.floor(total / 1000))) return failure('OVERFLOW', 'wallUs');
  const advanced = advanceTo(state, state.nowMs + Math.floor(total / 1000)); if (!advanced.ok) return advanced;
  return success(Object.freeze({ ...advanced.value, driver: immutable({ ...driver, lastWallUs: wallUs, remainderUs: total % 1000 }) }));
}
/**
 * Future host transaction: sample under old speed/pause, then commit the command.
 * Rejection returns no candidate value: caller retains BOTH old state and old driver.
 * Resume/show samples while still paused, thereby excluding the paused wall interval.
 */
export function applyWallControl(state: Engine, driver: Driver, wallUs: unknown, input: unknown): Checked<DriverStep> {
  const command = validateCommand(input); if (!command.ok) return command;
  if (!['set-pause', 'speed', 'end'].includes(command.value.kind)) return failure('INVALID_CONTROL', 'command');
  const sampled = sampleWall(state, driver, wallUs); if (!sampled.ok) return sampled;
  const action = applyAction(sampled.value.state, command.value);
  if (!action.accepted) return Object.freeze({ ok: false, issues: action.issues });
  return success(Object.freeze({ state: action.state, driver: sampled.value.driver,
    emitted: Object.freeze([...sampled.value.emitted, ...action.emitted]) }));
}

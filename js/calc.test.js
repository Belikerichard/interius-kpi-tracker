import { test } from 'node:test';
import assert from 'node:assert/strict';
import { achievement, statusOf, ratingFromScore, avgAchievement } from './calc.js';

test('achievement: meta hacia arriba (mayor es mejor)', () => {
  assert.equal(achievement({ meta: 100, actual: 80, direccion: 'up' }), 80);
  assert.equal(achievement({ meta: 100, actual: 120, direccion: 'up' }), 120);
});

test('achievement: meta hacia abajo (menor es mejor)', () => {
  assert.equal(achievement({ meta: 180, actual: 90, direccion: 'down' }), 200);
  assert.equal(achievement({ meta: 180, actual: 0, direccion: 'down' }), 100); // evita división entre cero
});

test('achievement: sin meta no explota', () => {
  assert.equal(achievement({ meta: 0, actual: 50, direccion: 'up' }), 0);
});

test('statusOf: umbrales', () => {
  assert.equal(statusOf(95), 'ok');
  assert.equal(statusOf(94.9), 'warn');
  assert.equal(statusOf(75), 'warn');
  assert.equal(statusOf(74.9), 'bad');
});

test('avgAchievement: capa cada kpi a 130% antes de promediar', () => {
  const kpis = [
    { meta: 100, actual: 200, direccion: 'up' }, // 200% -> capado a 130
    { meta: 100, actual: 100, direccion: 'up' }, // 100%
  ];
  assert.equal(avgAchievement(kpis), (130 + 100) / 2);
});

test('avgAchievement: lista vacía es 0', () => {
  assert.equal(avgAchievement([]), 0);
});

test('ratingFromScore: umbrales', () => {
  assert.equal(ratingFromScore(95).label, 'Excelente');
  assert.equal(ratingFromScore(80).label, 'Bueno');
  assert.equal(ratingFromScore(60).label, 'Regular');
  assert.equal(ratingFromScore(59).label, 'Necesita atención');
});

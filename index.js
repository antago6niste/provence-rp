#!/usr/bin/env node
// Petit wrapper pour lancer le bot principal
try {
  require('./bots');
} catch (err) {
  console.error('Erreur lors du require(\'./bots\'):', err);
  process.exit(1);
}

#!/usr/bin/env node

/**
 * Point d'entrée principal du bot Discord
 * Compatible avec tous les hébergeurs (WISP, Pterodactyl, etc)
 */

require('dotenv').config();

console.log('🤖 Démarrage du bot Discord...');
console.log(`📅 ${new Date().toLocaleString('fr-FR')}`);

// Vérifier les variables d'environnement
const requiredEnvVars = ['DISCORD_TOKEN', 'CLIENT_ID'];
const missingVars = requiredEnvVars.filter(v => !process.env[v]);

if (missingVars.length > 0) {
  console.error(`❌ ERREUR: Variables d'environnement manquantes: ${missingVars.join(', ')}`);
  console.error('ℹ️  Configurez les variables sur votre hébergeur');
  process.exit(1);
}

// Démarrer le bot
try {
  require('./bots.js');
  console.log('✅ Bot chargé avec succès');
} catch (err) {
  console.error('❌ Erreur lors du démarrage du bot:', err.message);
  console.error(err.stack);
  process.exit(1);
}

// Gestion des erreurs
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Promesse rejetée non gérée:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Exception non capturée:', error);
  process.exit(1);
});

process.on('SIGTERM', () => {
  console.log('📢 Fermeture gracieuse...');
  process.exit(0);
});

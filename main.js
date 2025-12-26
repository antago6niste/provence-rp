#!/usr/bin/env node

/**
 * Script de démarrage du bot Discord
 * Compatible avec YorkHost et autres hébergeurs
 */

console.log('🤖 Démarrage du bot Discord...');
console.log(`📅 ${new Date().toLocaleString('fr-FR')}`);

// Vérifier les variables d'environnement
const requiredEnvVars = ['DISCORD_TOKEN', 'CLIENT_ID'];
const missingVars = requiredEnvVars.filter(v => !process.env[v]);

if (missingVars.length > 0) {
  console.error(`❌ ERREUR: Variables d'environnement manquantes: ${missingVars.join(', ')}`);
  console.error('ℹ️  Créez un fichier .env avec:');
  console.error('   DISCORD_TOKEN=votre_token');
  console.error('   CLIENT_ID=votre_id');
  process.exit(1);
}

// Charger dotenv
require('dotenv').config();

// Démarrer le bot
try {
  require('./bots.js');
  console.log('✅ Bot chargé avec succès');
  console.log('💡 Astuce: Les logs des événements s\'afficheront ci-dessous');
} catch (err) {
  console.error('❌ Erreur lors du démarrage du bot:', err.message);
  console.error(err.stack);
  process.exit(1);
}

// Gestion des erreurs non capturées
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Promesse rejetée non gérée:', reason);
  console.error(promise);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Exception non capturée:', error);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('📢 Fermeture gracieuse du bot...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('\n📢 Arrêt du bot (Ctrl+C)...');
  process.exit(0);
});

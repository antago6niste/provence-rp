# 🚀 Guide de déploiement sur YorkHost

## Prérequis
- Un compte YorkHost
- Git installé
- Un bot Discord créé sur Discord Developer Portal

## Étapes de déploiement

### 1. Préparation du dépôt Git

```bash
cd provence-rp
git init
git add .
git commit -m "Initial commit: Discord bot configuration"
git remote add yorkhost <votre-yorkhost-git-url>
```

### 2. Pousser vers YorkHost

```bash
git push yorkhost main
```

### 3. Configuration sur le dashboard YorkHost

1. Connectez-vous au dashboard YorkHost
2. Créez une nouvelle application Node.js
3. Pointez-la vers votre dépôt Git
4. Configurez les variables d'environnement:
   - `DISCORD_TOKEN` → Votre token Discord
   - `CLIENT_ID` → Votre Client ID Discord
   - `MONGODB_URI` → (Optionnel) Votre URI MongoDB
   - `NODE_ENV` → `production`

### 4. Déploiement

Cliquez sur **Deploy** dans le dashboard YorkHost

### 5. Vérification

- Consultez les logs en temps réel
- Vérifiez que le bot s'est connecté à Discord
- Testez les commandes sur votre serveur

## 📊 Monitoring

YorkHost propose:
- 📈 Graphiques de CPU/RAM
- 📋 Logs en temps réel
- 🔄 Auto-redémarrage en cas de crash
- 💾 Sauvegardes automatiques

## ⚠️ Considérations importantes

### Stockage des données
- Par défaut: `data.json` dans le conteneur (réinitié à chaque déploiement)
- Solution: Utilisez MongoDB pour la persistance

### Redémarrages automatiques
YorkHost redémarre automatiquement le bot s'il s'arrête, c'est normal.

### Limites de ressources
- Mémoire par défaut: 512MB
- CPU: Partagé
- À adapter selon vos besoins dans `.yorkhost.yml`

## 🔧 Dépannage

### Le bot ne démarre pas
```bash
# Vérifiez les logs
# Dashboard YorkHost → Logs → Scroll vers le haut
```

### "Cannot find module"
```bash
# Assurez-vous que npm install s'exécute
# Vérifiez package.json et package-lock.json
```

### Variables d'environnement non reconnues
- Redéployez après avoir ajouté les variables
- YorkHost les injecte au démarrage

### La base de données réinitialise
- Utilisez MongoDB à la place de `data.json`
- Configurez `MONGODB_URI` dans les variables d'environnement

## 📞 Support YorkHost

- Documentation: [docs.yorkhost.io](https://docs.yorkhost.io)
- Email: support@yorkhost.io
- Discord Community: [Rejoignez leur Discord](https://discord.gg/yorkhost)

## 🎯 Prochaines étapes

1. **Optimiser la base de données**: Migrez vers MongoDB Atlas
2. **Ajouter plus de commandes**: Consultez la doc Discord.js
3. **Monitorer les performances**: Utilisez des outils APM
4. **Configurer des backups**: Sauvegardez régulièrement `data.json` ou MongoDB

---

**Happy hosting! 🎉**

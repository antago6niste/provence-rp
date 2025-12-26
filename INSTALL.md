# 🤖 Discord Bot de Modération - Provence RP

Bot Discord complet avec système de modération avancé et protections automatiques.

## ✨ Fonctionnalités

- ✅ **Modération complète**: Ban, Mute temporaire, Kick
- ✅ **Protections automatiques**:
  - 🔥 Anti-Spam
  - 🚫 Anti-Insultes
  - 🚨 Anti-Raid
  - 💥 Anti-Nuke
  - 📢 Anti-Caps excessif
  - 👻 Anti-Ghost Ping
- ✅ **Système de logs** détaillé
- ✅ **Persistance des données** (MongoDB ou fichier JSON)
- ✅ **Commandes Slash** et textuelles

## 🚀 Installation sur YorkHost

### 1. Déployer le projet
```bash
git clone <votre-repo>
cd provence-rp
npm install
```

### 2. Configurer les variables d'environnement
Créez un fichier `.env` à la racine avec:

```env
DISCORD_TOKEN=votre_token_discord
CLIENT_ID=votre_client_id
MONGODB_URI=  # Optionnel - laissez vide pour utiliser data.json
NODE_ENV=production
```

### 3. Démarrer le bot
```bash
npm start
```

## 📋 Configuration du Bot Discord

1. Allez sur [Discord Developer Portal](https://discord.com/developers/applications)
2. Créez une nouvelle application
3. Dans **Bot**, copiez votre **TOKEN** → mettez-le dans `.env` comme `DISCORD_TOKEN`
4. Dans **General Information**, copiez votre **APPLICATION ID** → mettez-le comme `CLIENT_ID`
5. Dans **OAuth2 > URL Generator**:
   - Scopes: `bot`
   - Permissions: `ADMINISTRATOR` (ou les permissions spécifiques que vous voulez)
   - Copiez l'URL générée et invitez le bot sur votre serveur

## 🔧 Commandes Slash

| Commande | Usage | Description |
|----------|-------|-------------|
| `/help` | `/help` | Affiche l'aide complète |
| `/config staff` | `/config staff @role` | Définit le rôle staff |
| `/config logs` | `/config logs #channel` | Définit le canal de logs |
| `/tempmute` | `/tempmute @user` | Mute temporairement avec menu de sanctions |
| `/unmute` | `/unmute @user` | Retire le mute |
| `/ban` | `/ban @user [raison]` | Bannit un membre |
| `/unban` | `/unban <ID>` | Débannit un membre |
| `/clear` | `/clear [nombre]` | Supprime les messages récents |
| `/message efface` | `/message efface @user [nombre]` | Supprime les messages d'un membre |

## 🛡️ Protections Automatiques

### Anti-Spam
- Détecte 5+ messages en 5 secondes
- Action: Mute automatique (10m)

### Anti-Insultes
- Liste personnalisable de mots interdits
- Action: Suppression du message + avertissement

### Anti-Raid
- Détecte 5+ jointures en 10 secondes
- Action: Ban automatique

### Anti-Nuke
- Détecte 10+ actions (création/suppression canal/rôle) en 10s
- Action: Lockdown du serveur

### Anti-Caps
- Détecte 70%+ de majuscules dans un message
- Action: Suppression du message

### Anti-Ghost Ping
- Détecte les mentions supprimées
- Action: Avertissement MP

## 📊 Structure des données

### Avec MongoDB
Les données sont sauvegardées dans la base `discordbot`, collection `botdata`.

### Avec fichier JSON (par défaut)
Les données sont sauvegardées dans `data.json`:
```json
{
  "mutes": [],
  "config": {
    "staffRoleId": "123456789",
    "logsChannelId": "987654321",
    "protections": { ... }
  }
}
```

## ⚠️ Sécurité

- 🔐 **Ne partagez JAMAIS votre token Discord**
- 🔐 **Ne committez PAS le fichier `.env`** (il est dans `.gitignore`)
- 🔐 **Utilisez des variables d'environnement** pour tous les secrets

## 📝 Logs

Tous les événements sont enregistrés dans le canal défini par `/config logs`:
- Mutes, Unmutes, Bans, Unbans
- Suppressions de messages
- Détections de protections automatiques
- Changements de configuration

## 🐛 Dépannage

### Le bot ne se connecte pas
- ✅ Vérifiez que `DISCORD_TOKEN` est correct
- ✅ Vérifiez que le bot n'est pas déjà connecté ailleurs

### Les commandes ne fonctionnent pas
- ✅ Assurez-vous que `CLIENT_ID` est correct
- ✅ Attendez quelques secondes après le démarrage (enregistrement des commandes)

### MongoDB ne se connecte pas
- ✅ Laissez `MONGODB_URI` vide pour utiliser `data.json`
- ✅ Vérifiez votre URI MongoDB si vous l'utilisez

## 📞 Support

Pour toute question, consultez la [documentation Discord.js](https://discord.js.org/)

---

**Version**: 1.0.0  
**Hébergeur**: YorkHost  
**Auteur**: Provence RP

# Provence RP - Bot de Modération Discord

Bot de modération Discord avec commandes slash et préfixées, logs automatiques et système de permissions.

## Fonctionnalités

- ✅ Commandes slash modernes (`/tempmute`, `/ban`, etc.)
- ✅ Commandes préfixées (`/help`, `/config`)
- ✅ Logs automatiques des actions staff
- ✅ Système de permissions par rôle
- ✅ Mutes temporaires avec menu interactif
- ✅ Ban/Unban avec raisons

## Installation Locale

1. Clonez le repo :
   ```bash
   git clone https://github.com/antago6niste/provence-rp.git
   cd provence-rp
   ```

2. Installez les dépendances :
   ```bash
   npm install
   ```

3. Configurez les variables d'environnement :
   - Copiez `.env.example` vers `.env`
   - Remplissez `DISCORD_TOKEN`, `CLIENT_ID` et `MONGODB_URI`

## Configuration MongoDB (Persistance des données)

Pour que la configuration survive aux redémarrages :

1. Créez un compte gratuit sur [MongoDB Atlas](https://www.mongodb.com/atlas)
2. Créez un cluster gratuit
3. Créez un utilisateur de base de données
4. Récupérez l'URI de connexion (format : `mongodb+srv://user:pass@cluster.mongodb.net/dbname`)
5. Ajoutez l'URI dans `.env` sous `MONGODB_URI`

Sans MongoDB, les données seront perdues à chaque redémarrage.

4. Lancez le bot :
   ```bash
   npm start
   ```

## Déploiement Gratuit 24/7

### Option 1: Railway (Recommandé)

1. Créez un compte sur [Railway](https://railway.app)
2. Connectez votre repo GitHub
3. Ajoutez les variables d'environnement :
   - `DISCORD_TOKEN` : Votre token Discord
   - `CLIENT_ID` : L'ID de votre application Discord
   - `MONGODB_URI` : URI MongoDB Atlas (pour la persistance)
4. Déployez automatiquement

### Option 2: Render

1. Créez un compte sur [Render](https://render.com)
2. Créez un nouveau service "Web Service"
3. Connectez votre repo GitHub
4. Configurez :
   - Runtime: Node
   - Build Command: `npm install`
   - Start Command: `npm start`
5. Ajoutez les variables d'environnement :
   - `DISCORD_TOKEN`
   - `CLIENT_ID`
   - `MONGODB_URI`

### Option 3: Fly.io

1. Installez Fly CLI : `curl -L https://fly.io/install.sh | sh`
2. Créez une app : `fly launch`
3. Configurez les secrets : `fly secrets set DISCORD_TOKEN=your_token CLIENT_ID=your_id MONGODB_URI=your_mongo_uri`
4. Déployez : `fly deploy`

## Configuration

- `/config staff @role` : Définit le rôle staff
- `/config logs #channel` : Définit le canal de logs

## Permissions Requises

Le bot a besoin des permissions suivantes :
- Lire les messages
- Envoyer des messages
- Gérer les messages
- Gérer les rôles (pour les mutes)
- Bannir des membres
- Voir les membres

## Support

Pour les problèmes, vérifiez les logs du bot ou contactez le développeur.
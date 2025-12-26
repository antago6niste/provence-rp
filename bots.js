const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, REST, Routes, SlashCommandBuilder, MessageFlags } = require('discord.js');
const fs = require('fs');
const ms = require('ms');
const { MongoClient, ServerApiVersion } = require('mongodb');
require('dotenv').config();

const PREFIX = '/'; // Préfixe pour les commandes textuelles

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates
  ]
});

const commands = [
  new SlashCommandBuilder()
    .setName('help')
    .setDescription('Affiche l\'aide du bot de modération'),
  new SlashCommandBuilder()
    .setName('config')
    .setDescription('Configure le bot')
    .addSubcommand(subcommand =>
      subcommand
        .setName('staff')
        .setDescription('Définit le rôle staff')
        .addRoleOption(option =>
          option.setName('role')
            .setDescription('Le rôle staff')
            .setRequired(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('logs')
        .setDescription('Définit le canal de logs')
        .addChannelOption(option =>
          option.setName('channel')
            .setDescription('Le canal de logs')
            .setRequired(true))),
  new SlashCommandBuilder()
    .setName('tempmute')
    .setDescription('Mute temporairement un membre')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('Le membre à mute')
        .setRequired(true)),
  new SlashCommandBuilder()
    .setName('unmute')
    .setDescription('Retire le mute d\'un membre')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('Le membre à unmute')
        .setRequired(true)),
  new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Bannit un membre')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('Le membre à bannir')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('reason')
        .setDescription('La raison du ban')
        .setRequired(false)),
  new SlashCommandBuilder()
    .setName('unban')
    .setDescription('Débannit un membre')
    .addStringOption(option =>
      option.setName('userid')
        .setDescription('L\'ID du membre à débannir')
        .setRequired(true)),
  new SlashCommandBuilder()
    .setName('clear')
    .setDescription('Supprime les messages récents du salon')
    .addIntegerOption(option =>
      option.setName('amount')
        .setDescription('Nombre de messages à supprimer (1-100)')
        .setRequired(false)
        .setMinValue(1)
        .setMaxValue(100)),
  new SlashCommandBuilder()
    .setName('message')
    .setDescription('Gère les messages')
    .addSubcommand(subcommand =>
      subcommand
        .setName('efface')
        .setDescription('Supprime les messages d\'un membre')
        .addUserOption(option =>
          option.setName('user')
            .setDescription('Le membre dont supprimer les messages')
            .setRequired(true))
        .addIntegerOption(option =>
          option.setName('amount')
            .setDescription('Nombre de messages à vérifier (1-100)')
            .setRequired(false)
            .setMinValue(1)
            .setMaxValue(100)))
];

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  if (!process.env.CLIENT_ID) {
    console.log('⚠️ CLIENT_ID non défini. Les commandes slash ne seront pas enregistrées.');
    return;
  }
  try {
    console.log('🔄 Enregistrement des commandes slash...');

    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: commands.map(command => command.toJSON()) },
    );

    console.log('✅ Commandes slash enregistrées avec succès.');
  } catch (error) {
    console.error('❌ Erreur lors de l\'enregistrement des commandes:', error);
  }
})();

// Connexion MongoDB
const uri = process.env.MONGODB_URI || "mongodb://localhost:27017/discordbot";
const mongoClient = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function connectMongo() {
  try {
    await mongoClient.connect();
    await mongoClient.db("admin").command({ ping: 1 });
    console.log("✅ Pinged your deployment. You successfully connected to MongoDB!");
  } catch (err) {
    console.error('❌ Erreur MongoDB:', err);
  }
}

if (process.env.MONGODB_URI) {
  connectMongo();
} else {
  console.log('⚠️ MONGODB_URI non défini - Utilisation du système de fichiers (données non persistantes)');
}

// Charger les données
let db = { 
  mutes: [], 
  config: { 
    staffRoleId: '1423018980465049734', 
    logsChannelId: '1423018982494961679',
    protections: {
      antiSpam: { enabled: true, maxMessages: 5, timeWindow: 5000, action: 'mute', duration: '10m' },
      antiInsultes: { enabled: true, words: ['insulte1', 'insulte2', 'con', 'pute', 'salope', 'enculé', 'fdp', 'pd', 'ntm', 'tg', 'fuck', 'shit', 'bitch', 'asshole'], action: 'delete', warn: true },
      antiRaid: { enabled: true, maxJoins: 5, timeWindow: 10000, action: 'ban' },
      antiNuke: { enabled: true, maxActions: 10, timeWindow: 10000, action: 'lockdown' },
      antiCaps: { enabled: true, threshold: 70, minLength: 10, action: 'delete' },
      antiGhostPing: { enabled: true, action: 'warn' },
      antiLinks: { enabled: false, whitelist: [], action: 'delete' }
    }
  }
};

// Maps pour les protections automatiques
const spamTracker = new Map();
const raidTracker = new Map();
const nukeTracker = new Map();
async function loadDB() {
  if (mongoClient && mongoClient.topology && mongoClient.topology.isConnected()) {
    try {
      const database = mongoClient.db('discordbot');
      const collection = database.collection('botdata');
      const data = await collection.findOne({ _id: 'botdata' });
      if (data) {
        db = { config: data.config || db.config, mutes: data.mutes || [] };
      } else {
        // Créer le document par défaut
        await collection.insertOne({ _id: 'botdata', config: db.config, mutes: [] });
      }
    } catch (err) {
      console.error('Erreur chargement DB:', err);
    }
  } else {
    // Fallback to file
    try {
      if (fs.existsSync('data.json')) {
        const data = JSON.parse(fs.readFileSync('data.json', 'utf8'));
        db = { ...db, ...data };
      }
    } catch (err) {
      console.error('Erreur lecture data.json:', err);
    }
  }
}

async function saveDB() {
  if (mongoClient && mongoClient.topology && mongoClient.topology.isConnected()) {
    try {
      const database = mongoClient.db('discordbot');
      const collection = database.collection('botdata');
      await collection.replaceOne({ _id: 'botdata' }, { _id: 'botdata', config: db.config, mutes: db.mutes }, { upsert: true });
    } catch (err) {
      console.error('Erreur sauvegarde DB:', err);
    }
  } else {
    // Fallback to file
    try {
      fs.writeFileSync('data.json', JSON.stringify(db, null, 2));
    } catch (err) {
      console.error('Erreur sauvegarde data.json:', err);
    }
  }
}

async function lockdownGuild(guild, reason) {
  try {
    // Créer un rôle de lockdown
    const lockdownRole = await guild.roles.create({
      name: '🔒 Lockdown',
      permissions: [],
      reason: 'Protection anti-nuke automatique'
    });

    // Appliquer aux canaux texte
    for (const channel of guild.channels.cache.values()) {
      if (channel.type === 0) { // GUILD_TEXT
        await channel.permissionOverwrites.edit(lockdownRole, {
          SendMessages: false,
          AddReactions: false
        }).catch(() => {});
      }
    }

    sendLog(guild, '🔒 Lockdown Activé', `🛡️ **Protection anti-nuke**\n📄 Raison : ${reason}\n👮 Rôle créé : ${lockdownRole.name}`, 'Red');
  } catch (err) {
    console.error('Erreur lockdown:', err.message);
  }
}

async function checkAntiSpam(message) {
  if (message.author.bot || !db.config?.protections) return;

  const userId = message.author.id;
  const now = Date.now();
  const config = db.config.protections.antiSpam;

  if (!spamTracker.has(userId)) {
    spamTracker.set(userId, []);
  }

  const userMessages = spamTracker.get(userId);
  userMessages.push(now);

  // Nettoyer les messages anciens
  const recentMessages = userMessages.filter(time => now - time < config.timeWindow);

  if (recentMessages.length > config.maxMessages) {
    // Action anti-spam
    if (config.action === 'mute') {
      const member = message.member;
      if (member && !member.roles.cache.has(db.config.staffRoleId)) {
        const duration = ms(config.duration);
        await applyTempMute(member, duration, 'Anti-Spam automatique', null);
        sendLog(message.guild, '🚫 Anti-Spam', `👤 **${message.author.tag}** détecté pour spam\n⏱️ Sanction : Mute ${config.duration}`, 'Orange');
      }
    }

    // Supprimer les messages récents
    try {
      const messagesToDelete = await message.channel.messages.fetch({ limit: 10 });
      const userRecentMessages = messagesToDelete.filter(msg => 
        msg.author.id === userId && 
        Date.now() - msg.createdTimestamp < 10000
      );
      if (userRecentMessages.size > 0) {
        await message.channel.bulkDelete(userRecentMessages, true);
      }
    } catch (err) {
      console.error('Erreur suppression spam:', err.message);
    }
  }

  spamTracker.set(userId, recentMessages);
}

async function checkAntiInsultes(message) {
  if (message.author.bot || !db.config?.protections) return;

  const config = db.config.protections.antiInsultes;
  const content = message.content.toLowerCase();

  const hasInsulte = config.words.some(word => content.includes(word.toLowerCase()));

  if (hasInsulte) {
    if (config.action === 'delete') {
      try {
        await message.delete();
        sendLog(message.guild, '🚫 Anti-Insultes', `👤 **${message.author.tag}** a utilisé un mot interdit\n💬 Message supprimé`, 'Red');
        
        if (config.warn) {
          const warnEmbed = new EmbedBuilder()
            .setTitle('⚠️ Avertissement')
            .setDescription('Votre message contenait un mot interdit et a été supprimé.')
            .setColor('Orange')
            .setFooter({ text: 'Comportez-vous correctement sur ce serveur.' });
          
          message.author.send({ embeds: [warnEmbed] }).catch(() => {});
        }
      } catch (err) {
        console.error('Erreur anti-insultes:', err.message);
      }
    }
  }
}

async function checkAntiCaps(message) {
  if (message.author.bot || !db.config?.protections) return;

  const config = db.config.protections.antiCaps;
  const content = message.content;

  if (content.length < config.minLength) return;

  const capsCount = (content.match(/[A-Z]/g) || []).length;
  const capsPercentage = (capsCount / content.length) * 100;

  if (capsPercentage >= config.threshold) {
    if (config.action === 'delete') {
      try {
        await message.delete();
        sendLog(message.guild, '🚫 Anti-Caps', `👤 **${message.author.tag}** a utilisé trop de majuscules (${capsPercentage.toFixed(1)}%)\n💬 Message supprimé`, 'Orange');
      } catch (err) {
        console.error('Erreur anti-caps:', err.message);
      }
    }
  }
}

async function checkAntiGhostPing(message) {
  if (message.author.bot || !db.config?.protections) return;

  const mentionedUsers = message.mentions.users;
  if (mentionedUsers.size === 0) return;

  // Vérifier si des mentions ont été supprimées (ghost ping)
  setTimeout(async () => {
    try {
      const currentMessage = await message.channel.messages.fetch(message.id);
      const currentMentions = currentMessage.mentions.users;

      if (currentMentions.size < mentionedUsers.size) {
        sendLog(message.guild, '👻 Ghost Ping Détecté', `👤 **${message.author.tag}** a supprimé des mentions\n💬 Message original : ${message.content.substring(0, 100)}...`, 'Yellow');
        
        if (db.config.protections.antiGhostPing.action === 'warn') {
          message.author.send('⚠️ **Ghost ping détecté** : Évitez de mentionner puis supprimer vos messages.').catch(() => {});
        }
      }
    } catch (err) {
      // Message supprimé ou inaccessible
    }
  }, 1000);
}

async function checkAntiRaid(member) {
  if (!db.config?.protections) return;

  const guild = member.guild;
  const now = Date.now();
  const config = db.config.protections.antiRaid;

  if (!raidTracker.has(guild.id)) {
    raidTracker.set(guild.id, []);
  }

  const joins = raidTracker.get(guild.id);
  joins.push(now);

  // Nettoyer les anciens joins
  const recentJoins = joins.filter(time => now - time < config.timeWindow);

  if (recentJoins.length > config.maxJoins) {
    // Action anti-raid
    if (config.action === 'ban') {
      try {
        await member.ban({ reason: 'Anti-raid automatique - Join massif détecté' });
        sendLog(guild, '🚫 Anti-Raid', `👤 **${member.user.tag}** banni automatiquement\n📊 ${recentJoins.length} joins en ${config.timeWindow/1000}s`, 'Red');
      } catch (err) {
        console.error('Erreur anti-raid ban:', err.message);
      }
    }
  }

  raidTracker.set(guild.id, recentJoins);
}

async function checkAntiNuke(guild, action) {
  if (!db.config?.protections) return;

  const now = Date.now();
  const config = db.config.protections.antiNuke;

  if (!nukeTracker.has(guild.id)) {
    nukeTracker.set(guild.id, { actions: [], lastReset: now });
  }

  const tracker = nukeTracker.get(guild.id);
  
  // Reset si plus de 1 minute
  if (now - tracker.lastReset > 60000) {
    tracker.actions = [];
    tracker.lastReset = now;
  }

  tracker.actions.push(now);

  // Garder seulement les actions récentes
  tracker.actions = tracker.actions.filter(time => now - time < config.timeWindow);

  if (tracker.actions.length > config.maxActions) {
    if (config.action === 'lockdown') {
      await lockdownGuild(guild, `Nuke détecté : ${tracker.actions.length} actions en ${config.timeWindow/1000}s`);
    }
  }

  nukeTracker.set(guild.id, tracker);
}

function sendLog(guild, title, description, color) {
  try {
    const channel = guild.channels.cache.get(db.config.logsChannelId);
    if (!channel) return;

    const embed = new EmbedBuilder()
      .setTitle(title)
      .setDescription(description)
      .setColor(color)
      .setTimestamp();

    channel.send({ embeds: [embed] }).catch(err => {
      console.error('Erreur envoi log:', err.message);
    });
  } catch (err) {
    console.error('Erreur sendLog:', err.message);
  }
}

async function getMutedRole(guild) {
  try {
    let role = guild.roles.cache.find(r => r.name === 'Muted');
    if (!role) {
      role = await guild.roles.create({
        name: 'Muted',
        permissions: []
      });
      
      for (const channel of guild.channels.cache.values()) {
        await channel.permissionOverwrites.edit(role, {
          SendMessages: false,
          Speak: false,
          AddReactions: false
        }).catch(() => {});
      }
    }
    return role;
  } catch (err) {
    console.error('Erreur getMutedRole:', err.message);
    return null;
  }
}

async function applyTempMute(member, duration, reason, interaction = null) {
  try {
    const mutedRole = await getMutedRole(member.guild);
    if (!mutedRole) {
      if (interaction) {
        return interaction.reply({ content: '❌ **Erreur** : Impossible de créer ou trouver le rôle "Muted". Vérifiez les permissions du bot.', flags: MessageFlags.Ephemeral });
      }
      return false;
    }

    const savedRoles = member.roles.cache
      .filter(r => r.id !== member.guild.id && r.id !== mutedRole.id)
      .map(r => r.id);

    await member.roles.set([mutedRole.id]);
    
    if (member.voice.channel) {
      await member.voice.disconnect().catch(() => {});
    }

    db.mutes.push({
      userId: member.id,
      guildId: member.guild.id,
      roles: savedRoles,
      end: Date.now() + duration,
      reason: reason
    });
    saveDB();

    sendLog(
      member.guild,
      '🔇 TempMute appliqué',
      `👤 Utilisateur : **${member.user.tag}**\n⏱️ Durée : **${ms(duration, { long: true })}**\n📄 Raison : **${reason}**`,
      'Orange'
    );

    return true;
  } catch (err) {
    console.error('Erreur applyTempMute:', err.message);
    if (interaction) {
      await interaction.reply({ 
        content: `❌ **Erreur lors du mute** : ${err.message === 'Missing Permissions' ? 'Permissions insuffisantes (le bot doit avoir un rôle plus élevé que la cible)' : 'Une erreur inattendue est survenue. Réessayez plus tard.'}`, 
        flags: MessageFlags.Ephemeral 
      }).catch(() => {});
    }
    return false;
  }
}

async function unmute(member, manual = false) {
  try {
    const data = db.mutes.find(m => m.userId === member.id && m.guildId === member.guild.id);
    if (!data) return false;

    const mutedRole = await getMutedRole(member.guild);
    if (mutedRole) {
      await member.roles.remove(mutedRole).catch(() => {});
    }
    
    for (const roleId of data.roles) {
      await member.roles.add(roleId).catch(() => {});
    }

    db.mutes = db.mutes.filter(m => !(m.userId === member.id && m.guildId === member.guild.id));
    saveDB();

    sendLog(
      member.guild,
      manual ? '🔊 Unmute manuel' : '🔊 Unmute automatique',
      `👤 Utilisateur : **${member.user.tag}** a été unmute`,
      'Green'
    );

    return true;
  } catch (err) {
    console.error('Erreur unmute:', err.message);
    return false;
  }
}

setInterval(async () => {
  try {
    const now = Date.now();
    const expiredMutes = db.mutes.filter(m => m.end <= now);
    
    for (const mute of expiredMutes) {
      const guild = client.guilds.cache.get(mute.guildId);
      if (!guild) {
        db.mutes = db.mutes.filter(m => !(m.userId === mute.userId && m.guildId === mute.guildId));
        saveDB();
        continue;
      }
      
      const member = await guild.members.fetch(mute.userId).catch(() => null);
      if (member) {
        await unmute(member);
      } else {
        db.mutes = db.mutes.filter(m => !(m.userId === mute.userId && m.guildId === mute.guildId));
        saveDB();
      }
    }
  } catch (err) {
    console.error('Erreur timer unmute:', err.message);
  }
}, 10000);

client.once('ready', async () => {
  await loadDB();
  console.log(`✅ Bot connecté : ${client.user.tag}`);
  console.log(`📊 Serveurs : ${client.guilds.cache.size}`);
});

client.on('error', err => {
  console.error('Erreur client Discord:', err.message);
});

process.on('unhandledRejection', err => {
  console.error('Erreur non gérée:', err.message);
});

client.on('messageCreate', async message => {
  try {
    // Ignorer les messages des bots
    if (message.author.bot) return;
    
    // Protections automatiques
    await checkAntiSpam(message);
    await checkAntiInsultes(message);
    await checkAntiCaps(message);
    await checkAntiGhostPing(message);

    // Vérifier si c'est une commande
    if (!message.content.startsWith(PREFIX)) return;
    if (!message.guild) return;

    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const cmd = args.shift().toLowerCase();

    if (cmd !== 'help' && cmd !== 'config' && !message.member.roles.cache.has(db.config.staffRoleId)) {
      return;
    }

    if (cmd === 'help') {
      const embed = new EmbedBuilder()
        .setTitle('🛡️ Aide du bot de modération')
        .setDescription('Voici les commandes disponibles sur le serveur :')
        .addFields(
          { name: '🔇 TempMute', value: '`/tempmute @user`\nMute temporairement un membre via un menu de sanctions.' },
          { name: '🔊 Unmute', value: '`/unmute @user`\nRetire le mute d\'un membre.' },
          { name: '🔨 Ban', value: '`/ban @user [raison]`\nBannit un membre du serveur.' },
          { name: '🔓 Unban', value: '`/unban <ID>`\nDébannit un membre via son ID.' },
          { name: '🗑️ Clear', value: '`/clear [nombre]`\nSupprime les messages récents du salon.' },
          { name: '📝 Message Efface', value: '`/message efface @user [nombre]`\nSupprime les messages d\'un membre.' },
          { name: '⚙️ Config', value: '`/config staff @role`\nDéfinit le rôle staff.\n`/config logs #channel`\nDéfinit le canal de logs.' },
          { name: '🛡️ Protections Automatiques', value: '🔥 **Anti-Spam** : Toujours actif - détecte et sanctionne le spam\n🚫 **Anti-Insultes** : Toujours actif - supprime les messages avec insultes\n🚨 **Anti-Raid** : Toujours actif - bloque les joins massifs\n💥 **Anti-Nuke** : Toujours actif - protège contre la destruction massive\n📢 **Anti-Caps** : Toujours actif - contrôle l\'usage excessif des majuscules\n👻 **Anti-Ghost Ping** : Toujours actif - détecte les mentions supprimées' }
        )
        .setColor('Blue')
        .setFooter({ text: 'Bot de modération • Sécurité active' });

      return message.channel.send({ embeds: [embed] }).catch(() => {});
    }

    if (cmd === 'config') {
      const subCmd = args[0];
      if (!subCmd) {
        return message.reply('❌ Utilisation: `/config staff @role` ou `/config logs #channel`').catch(() => {});
      }

      if (subCmd === 'staff') {
        const role = message.mentions.roles.first();
        if (!role) {
          return message.reply('❌ Mentionnez un rôle: `/config staff @role`').catch(() => {});
        }
        db.config.staffRoleId = role.id;
        saveDB();
        sendLog(message.guild, '⚙️ Configuration', `👤 Rôle staff défini sur **${role.name}** par ${message.author.tag}`, 'Blue');
        return message.reply(`✅ Rôle staff défini sur **${role.name}**`).catch(() => {});
      }

      if (subCmd === 'logs') {
        const channel = message.mentions.channels.first();
        if (!channel) {
          return message.reply('❌ Mentionnez un canal: `/config logs #channel`').catch(() => {});
        }
        db.config.logsChannelId = channel.id;
        saveDB();
        sendLog(message.guild, '⚙️ Configuration', `📝 Canal de logs défini sur **${channel.name}** par ${message.author.tag}`, 'Blue');
        return message.reply(`✅ Canal de logs défini sur **${channel.name}**`).catch(() => {});
      }

      return message.reply('❌ Sous-commande invalide. Utilisez `staff` ou `logs`').catch(() => {});
    }

    if (cmd === 'tempmute') {
      const userId = args[0];
      if (!userId) {
        return message.reply('❌ **Erreur** : Merci de fournir un **ID utilisateur** ou de mentionner un membre.').catch(() => {});
      }

      const member = await message.guild.members.fetch(userId).catch(() => null);
      if (!member) {
        return message.reply('❌ **Utilisateur introuvable** : Vérifiez l\'ID ou la mention.').catch(() => {});
      }

      if (member.id === message.author.id) {
        return message.reply('❌ **Action interdite** : Vous ne pouvez pas vous sanctionner vous-même.').catch(() => {});
      }

      if (member.roles.cache.has(db.config.staffRoleId)) {
        return message.reply('❌ **Action interdite** : Vous ne pouvez pas sanctionner un membre du staff.').catch(() => {});
      }

      const menu = new StringSelectMenuBuilder()
        .setCustomId(`mute_${member.id}`)
        .setPlaceholder('⏱️ Choisis la sanction')
        .addOptions([
          { label: 'Insulte légère', description: '20 minutes', value: 'insulte_legere_20m' },
          { label: 'Insulte grave', description: '50 minutes', value: 'insulte_grave_50m' },
          { label: 'Spam', description: '1 heure', value: 'spam_1h' },
          { label: 'Pub', description: '1 heure', value: 'pub_1h' },
          { label: 'BDSM', description: '2 heures', value: 'bdsm_2h' },
          { label: 'Comportement inapproprié', description: '40 minutes', value: 'comportement_40m' }
        ]);

      const row = new ActionRowBuilder().addComponents(menu);

      return message.channel.send({
        content: `🔧 Sanction à appliquer pour **${member.user.tag}**`,
        components: [row]
      }).catch(() => {});
    }

    if (cmd === 'unmute') {
      const userId = args[0];
      if (!userId) {
        return message.reply('❌ Merci de fournir un **ID utilisateur**').catch(() => {});
      }

      const member = await message.guild.members.fetch(userId).catch(() => null);
      if (!member) {
        return message.reply('❌ Utilisateur introuvable').catch(() => {});
      }

      const success = await unmute(member, true);
      if (success) {
        sendLog(message.guild, '🔊 Unmute', `👤 **${member.user.tag}** unmute par ${message.author.tag}`, 'Green');
        message.reply('✅ Membre unmute avec succès').catch(() => {});
      } else {
        message.reply('❌ Ce membre n\'est pas mute ou une erreur est survenue').catch(() => {});
      }
    }

    if (cmd === 'ban') {
      const userId = args[0];
      if (!userId) {
        return message.reply('❌ Merci de fournir un **ID utilisateur**').catch(() => {});
      }

      const reason = args.slice(1).join(' ') || 'Aucune raison';
      const member = await message.guild.members.fetch(userId).catch(() => null);
      
      if (!member) {
        return message.reply('❌ Utilisateur introuvable').catch(() => {});
      }

      if (!member.bannable) {
        return message.reply('❌ Je ne peux pas bannir ce membre (permissions insuffisantes)').catch(() => {});
      }

      try {
        await member.ban({ reason });
        sendLog(message.guild, '🔨 Ban', `👤 **${member.user.tag}**\n📄 Raison : ${reason}\n👮 Par : ${message.author.tag}`, 'Red');
        message.reply(`✅ **${member.user.tag}** a été banni`).catch(() => {});
      } catch (err) {
        message.reply(`❌ Erreur lors du ban: ${err.message}`).catch(() => {});
      }
    }

    if (cmd === 'unban') {
      const userId = args[0];
      if (!userId) {
        return message.reply('❌ ID requis').catch(() => {});
      }

      try {
        await message.guild.members.unban(userId);
        sendLog(message.guild, '🔓 Unban', `👤 Utilisateur ID : **${userId}**\n👮 Par : ${message.author.tag}`, 'Green');
        message.reply('✅ Utilisateur débanni avec succès').catch(() => {});
      } catch (err) {
        message.reply(`❌ Erreur lors du unban: ${err.message}`).catch(() => {});
      }
    }
  } catch (err) {
    console.error('Erreur messageCreate:', err.message);
  }
});

// Protection anti-raid
client.on('guildMemberAdd', async member => {
  try {
    await checkAntiRaid(member);
  } catch (err) {
    console.error('Erreur anti-raid:', err.message);
  }
});

// Protection anti-nuke
client.on('channelCreate', async channel => {
  try {
    await checkAntiNuke(channel.guild, 'channelCreate');
  } catch (err) {
    console.error('Erreur anti-nuke channelCreate:', err.message);
  }
});

client.on('channelDelete', async channel => {
  try {
    await checkAntiNuke(channel.guild, 'channelDelete');
  } catch (err) {
    console.error('Erreur anti-nuke channelDelete:', err.message);
  }
});

client.on('roleCreate', async role => {
  try {
    await checkAntiNuke(role.guild, 'roleCreate');
  } catch (err) {
    console.error('Erreur anti-nuke roleCreate:', err.message);
  }
});

client.on('roleDelete', async role => {
  try {
    await checkAntiNuke(role.guild, 'roleDelete');
  } catch (err) {
    console.error('Erreur anti-nuke roleDelete:', err.message);
  }
});

client.on('guildBanAdd', async (ban) => {
  try {
    await checkAntiNuke(ban.guild, 'banAdd');
  } catch (err) {
    console.error('Erreur anti-nuke banAdd:', err.message);
  }
});

client.on('interactionCreate', async interaction => {
  try {
    if (interaction.isChatInputCommand()) {
      if (interaction.commandName !== 'help' && !interaction.member.roles.cache.has(db.config.staffRoleId)) {
        return interaction.reply({ content: '❌ **Accès refusé** : Vous devez avoir le rôle staff pour utiliser cette commande.', flags: MessageFlags.Ephemeral });
      }

      if (interaction.commandName === 'help') {
        const embed = new EmbedBuilder()
          .setTitle('🛡️ Aide du bot de modération')
          .setDescription('Voici les commandes disponibles sur le serveur :')
          .addFields(
            { name: '🔇 TempMute', value: '`/tempmute @user`\nMute temporairement un membre via un menu de sanctions.' },
            { name: '🔊 Unmute', value: '`/unmute @user`\nRetire le mute d\'un membre.' },
            { name: '🔨 Ban', value: '`/ban @user [raison]`\nBannit un membre du serveur.' },
            { name: '🔓 Unban', value: '`/unban <ID>`\nDébannit un membre via son ID.' },
            { name: '🗑️ Clear', value: '`/clear [nombre]`\nSupprime les messages récents du salon.' },
            { name: '📝 Message Efface', value: '`/message efface @user [nombre]`\nSupprime les messages d\'un membre.' },
            { name: '⚙️ Config', value: '`/config staff @role`\nDéfinit le rôle staff.\n`/config logs #channel`\nDéfinit le canal de logs.' },
            { name: '🛡️ Protections Automatiques', value: '🔥 **Anti-Spam** : Toujours actif - détecte et sanctionne le spam\n🚫 **Anti-Insultes** : Toujours actif - supprime les messages avec insultes\n🚨 **Anti-Raid** : Toujours actif - bloque les joins massifs\n💥 **Anti-Nuke** : Toujours actif - protège contre la destruction massive\n📢 **Anti-Caps** : Toujours actif - contrôle l\'usage excessif des majuscules\n👻 **Anti-Ghost Ping** : Toujours actif - détecte les mentions supprimées' }
          )
          .setColor('Blue')
          .setFooter({ text: 'Bot de modération • Sécurité active' });

        return interaction.reply({ embeds: [embed] });
      }

      if (interaction.commandName === 'config') {
        const subCmd = interaction.options.getSubcommand();
        if (subCmd === 'staff') {
          const role = interaction.options.getRole('role');
          db.config.staffRoleId = role.id;
          saveDB();
          sendLog(interaction.guild, '⚙️ Configuration', `👤 Rôle staff défini sur **${role.name}** par ${interaction.user.tag}`, 'Blue');
          return interaction.reply(`✅ Rôle staff défini sur **${role.name}**`);
        }
        if (subCmd === 'logs') {
          const channel = interaction.options.getChannel('channel');
          db.config.logsChannelId = channel.id;
          saveDB();
          sendLog(interaction.guild, '⚙️ Configuration', `📝 Canal de logs défini sur **${channel.name}** par ${interaction.user.tag}`, 'Blue');
          return interaction.reply(`✅ Canal de logs défini sur **${channel.name}**`);
        }
      }

      if (interaction.commandName === 'tempmute') {
        const user = interaction.options.getUser('user');
        const member = await interaction.guild.members.fetch(user.id).catch(() => null);
        if (!member) {
          return interaction.reply({ content: '❌ **Utilisateur introuvable** : Vérifiez que ce membre est sur le serveur.', flags: MessageFlags.Ephemeral });
        }

        if (member.id === interaction.user.id) {
          return interaction.reply({ content: '❌ **Action interdite** : Vous ne pouvez pas vous sanctionner vous-même.', flags: MessageFlags.Ephemeral });
        }

        if (member.roles.cache.has(db.config.staffRoleId)) {
          return interaction.reply({ content: '❌ **Action interdite** : Vous ne pouvez pas sanctionner un membre du staff.', flags: MessageFlags.Ephemeral });
        }

        const menu = new StringSelectMenuBuilder()
          .setCustomId(`mute_${member.id}`)
          .setPlaceholder('⏱️ Choisis la sanction')
          .addOptions([
            { label: 'Insulte légère', description: '20 minutes', value: 'insulte_legere_20m' },
            { label: 'Insulte grave', description: '50 minutes', value: 'insulte_grave_50m' },
            { label: 'Spam', description: '1 heure', value: 'spam_1h' },
            { label: 'Pub', description: '1 heure', value: 'pub_1h' },
            { label: 'BDSM', description: '2 heures', value: 'bdsm_2h' },
            { label: 'Comportement inapproprié', description: '40 minutes', value: 'comportement_40m' }
          ]);

        const row = new ActionRowBuilder().addComponents(menu);

        return interaction.reply({
          content: `🔧 Sanction à appliquer pour **${member.user.tag}**`,
          components: [row]
        });
      }

      if (interaction.commandName === 'unmute') {
        const user = interaction.options.getUser('user');
        const member = await interaction.guild.members.fetch(user.id).catch(() => null);
        if (!member) {
          return interaction.reply({ content: '❌ **Utilisateur introuvable** : Vérifiez que ce membre est sur le serveur.', flags: MessageFlags.Ephemeral });
        }

        const success = await unmute(member, false);
        if (success) {
          sendLog(interaction.guild, '🔊 Unmute', `👤 **${member.user.tag}** unmute par ${interaction.user.tag}`, 'Green');
          return interaction.reply('✅ **Succès** : Membre unmute avec succès.');
        } else {
          return interaction.reply('❌ **Erreur** : Ce membre n\'est pas mute ou une erreur est survenue.');
        }
      }

      if (interaction.commandName === 'ban') {
        const user = interaction.options.getUser('user');
        const reason = interaction.options.getString('reason') || 'Aucune raison';
        const member = await interaction.guild.members.fetch(user.id).catch(() => null);
        
        if (!member) {
          return interaction.reply({ content: '❌ **Utilisateur introuvable** : Vérifiez que ce membre est sur le serveur.', flags: MessageFlags.Ephemeral });
        }

        if (!member.bannable) {
          return interaction.reply({ content: '❌ **Permissions insuffisantes** : Le bot ne peut pas bannir ce membre (rôle trop élevé).', flags: MessageFlags.Ephemeral });
        }

        try {
          await member.ban({ reason });
          sendLog(interaction.guild, '🔨 Ban', `👤 **${member.user.tag}**\n📄 Raison : ${reason}\n👮 Par : ${interaction.user.tag}`, 'Red');
          return interaction.reply(`✅ **Succès** : **${member.user.tag}** a été banni.`);
        } catch (err) {
          return interaction.reply(`❌ **Erreur lors du ban** : Une erreur inattendue est survenue.`);
        }
      }

      if (interaction.commandName === 'unban') {
        const userId = interaction.options.getString('userid');

        try {
          await interaction.guild.members.unban(userId);
          sendLog(interaction.guild, '🔓 Unban', `👤 Utilisateur ID : **${userId}**\n👮 Par : ${interaction.user.tag}`, 'Green');
          return interaction.reply('✅ **Succès** : Utilisateur débanni avec succès.');
        } catch (err) {
          return interaction.reply(`❌ **Erreur lors du unban** : ID invalide ou utilisateur non banni.`);
        }
      }

      if (interaction.commandName === 'clear') {
        const amount = interaction.options.getInteger('amount') || 50;

        try {
          const messages = await interaction.channel.messages.fetch({ limit: amount });
          const filteredMessages = messages.filter(msg => 
            Date.now() - msg.createdTimestamp < 14 * 24 * 60 * 60 * 1000 // 14 days
          );

          if (filteredMessages.size === 0) {
            return interaction.reply({ content: '❌ **Aucun message** : Aucun message récent à supprimer.', flags: MessageFlags.Ephemeral });
          }

          await interaction.channel.bulkDelete(filteredMessages, true);
          sendLog(interaction.guild, '🗑️ Clear', `🧹 **${filteredMessages.size}** messages supprimés dans ${interaction.channel.name}\n👮 Par : ${interaction.user.tag}`, 'Orange');
          return interaction.reply(`✅ **Succès** : **${filteredMessages.size}** messages supprimés.`);
        } catch (err) {
          return interaction.reply({ content: '❌ **Erreur** : Impossible de supprimer les messages (permissions insuffisantes ou messages trop anciens).', flags: MessageFlags.Ephemeral });
        }
      }

      if (interaction.commandName === 'message') {
        const subCmd = interaction.options.getSubcommand();

        if (subCmd === 'efface') {
          const user = interaction.options.getUser('user');
          const amount = interaction.options.getInteger('amount') || 50;

          try {
            const messages = await interaction.channel.messages.fetch({ limit: amount });
            const userMessages = messages.filter(msg => 
              msg.author.id === user.id && 
              Date.now() - msg.createdTimestamp < 14 * 24 * 60 * 60 * 1000 // 14 days
            );

            if (userMessages.size === 0) {
              return interaction.reply({ content: `❌ **Aucun message** : Aucun message récent de **${user.tag}** à supprimer.`, flags: MessageFlags.Ephemeral });
            }

            await interaction.channel.bulkDelete(userMessages, true);
            sendLog(interaction.guild, '🗑️ Message Efface', `🧹 **${userMessages.size}** messages de **${user.tag}** supprimés dans ${interaction.channel.name}\n👮 Par : ${interaction.user.tag}`, 'Orange');
            return interaction.reply(`✅ **Succès** : **${userMessages.size}** messages de **${user.tag}** supprimés.`);
          } catch (err) {
            return interaction.reply({ content: '❌ **Erreur** : Impossible de supprimer les messages (permissions insuffisantes ou messages trop anciens).', flags: MessageFlags.Ephemeral });
          }
        }
      }
    }

    if (interaction.isStringSelectMenu()) {
      if (interaction.customId.startsWith('mute_')) {
        const userId = interaction.customId.split('_')[1];
        const member = await interaction.guild.members.fetch(userId).catch(() => null);
        
        if (!member) {
          return interaction.reply({ content: '❌ **Erreur** : Utilisateur introuvable (il a peut-être quitté le serveur).', flags: MessageFlags.Ephemeral }).catch(() => {});
        }

        const sanctionMap = {
          'insulte_legere_20m': { duration: '20m', reason: 'Insulte légère' },
          'insulte_grave_50m': { duration: '50m', reason: 'Insulte grave' },
          'spam_1h': { duration: '1h', reason: 'Spam' },
          'pub_1h': { duration: '1h', reason: 'Pub' },
          'bdsm_2h': { duration: '2h', reason: 'BDSM' },
          'comportement_40m': { duration: '40m', reason: 'Comportement inapproprié' }
        };

        const sanction = sanctionMap[interaction.values[0]];
        if (!sanction) {
          return interaction.reply({ content: '❌ **Erreur** : Sanction invalide sélectionnée.', flags: MessageFlags.Ephemeral }).catch(() => {});
        }

        const duration = ms(sanction.duration);
        const success = await applyTempMute(member, duration, sanction.reason, interaction);

        if (success) {
          sendLog(interaction.guild, '🔇 TempMute', `👤 **${member.user.tag}** mute pour **${sanction.reason}** (${sanction.duration}) par ${interaction.user.tag}`, 'Orange');
          await interaction.reply({ content: `✅ **${member.user.tag}** a été mute pour **${sanction.reason}** (${sanction.duration})`, flags: MessageFlags.Ephemeral }).catch(() => {});
        }
      }
    }
  } catch (err) {
    console.error('Erreur interactionCreate:', err.message);
    if (interaction.replied || interaction.deferred) return;
    interaction.reply({ content: '❌ **Erreur inattendue** : Une erreur est survenue. Réessayez dans quelques instants.', flags: MessageFlags.Ephemeral }).catch(() => {});
  }
});

client.login(process.env.DISCORD_TOKEN).catch(err => {
  console.error('Erreur de connexion:', err.message);
  process.exit(1);
});

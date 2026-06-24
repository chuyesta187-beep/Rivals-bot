const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Partials,
  REST,
  Routes,
  SlashCommandBuilder
} = require("discord.js");

const express = require("express");
const app = express();

app.get("/", (req, res) => res.send("Bot activo"));
app.listen(process.env.PORT || 3000);

// ================= BOT =================

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.GuildMembers
  ],
  partials: [Partials.Channel]
});

const TOKEN = process.env.TOKEN;
const CLIENT_ID = "TU_CLIENT_ID";
const SERVER_ID = "TU_SERVER_ID";
const TICKET_CHANNEL_ID = "TU_CHANNEL_ID";

// tickets store
const tickets = new Map();

// ================= AUTO MOD =================

const badWords = ["puta", "mierda", "hack", "free robux"];
const spamMap = new Map();

client.on("messageCreate", (message) => {
  if (message.author.bot) return;
  if (!message.guild) return;
  if (message.guild.id !== SERVER_ID) return;

  const msg = message.content.toLowerCase();

  // palabras
  if (badWords.some(w => msg.includes(w))) {
    message.delete().catch(() => {});
    return message.channel.send(`🚫 ${message.author}, lenguaje no permitido.`);
  }

  // links
  if (msg.includes("http://") || msg.includes("https://") || msg.includes("discord.gg")) {
    message.delete().catch(() => {});
    return message.channel.send(`🚫 ${message.author}, no puedes enviar links.`);
  }

  // spam
  const now = Date.now();
  const data = spamMap.get(message.author.id) || { count: 0, last: now };

  if (now - data.last < 3000) {
    data.count++;
    if (data.count >= 5) {
      message.delete().catch(() => {});
      return message.channel.send(`🚫 ${message.author}, spam detectado.`);
    }
  } else {
    data.count = 1;
  }

  data.last = now;
  spamMap.set(message.author.id, data);
});

// ================= PANEL =================

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  if (message.guild?.id !== SERVER_ID) return;

  if (message.content === "!panel") {
    const embed = new EmbedBuilder()
      .setTitle("🎫 Tickets - Rivals Support")
      .setColor("Blue")
      .setDescription("Presiona el botón para abrir un ticket.");

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("ticket")
        .setLabel("Abrir Ticket")
        .setStyle(ButtonStyle.Success)
    );

    message.channel.send({ embeds: [embed], components: [row] });
  }
});

// ================= TICKETS =================

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isButton()) return;
  if (interaction.customId !== "ticket") return;

  const user = interaction.user;

  if (tickets.has(user.id)) {
    return interaction.reply({ content: "❌ Ya tienes un ticket activo.", ephemeral: true });
  }

  const dm = await user.createDM();

  tickets.set(user.id, { answers: [] });

  const questions = [
    "🎮 ¿Cuál es tu problema en Rivals?",
    "📸 ¿Tienes evidencia?",
    "🧠 Explica tu problema"
  ];

  let step = 0;

  await interaction.reply({ content: "📩 Revisa tu MD.", ephemeral: true });

  const startEmbed = new EmbedBuilder()
    .setTitle("🎫 Ticket Abierto")
    .setColor("Green")
    .setDescription("Responde las preguntas del soporte.");

  await dm.send({ embeds: [startEmbed] });
  await dm.send(questions[0]);

  const collector = dm.createMessageCollector({ time: 600000 });

  collector.on("collect", async (msg) => {
    if (msg.author.bot) return;

    const t = tickets.get(user.id);
    if (!t) return;

    t.answers.push(msg.content);
    step++;

    if (step < questions.length) {
      return dm.send(questions[step]);
    }

    collector.stop();

    const embed = new EmbedBuilder()
      .setTitle("📩 Nuevo Ticket")
      .setColor("Yellow")
      .addFields(
        { name: "👤 Usuario", value: `<@${user.id}>` },
        { name: "🎮 Problema", value: t.answers[0] || "N/A" },
        { name: "📸 Evidencia", value: t.answers[1] || "N/A" },
        { name: "🧠 Detalle", value: t.answers[2] || "N/A" }
      )
      .setTimestamp();

    const channel = client.channels.cache.get(TICKET_CHANNEL_ID);

    if (channel) {
      channel.send({ embeds: [embed] });
    }

    const finalDM = new EmbedBuilder()
      .setTitle("✅ Ticket enviado")
      .setColor("Green")
      .setDescription("El staff lo revisará pronto.");

    dm.send({ embeds: [finalDM] });
  });
});

// ================= SLASH COMMANDS =================

const commands = [
  new SlashCommandBuilder()
    .setName("kick")
    .setDescription("Expulsar usuario")
    .addUserOption(o =>
      o.setName("user").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("ban")
    .setDescription("Banear usuario")
    .addUserOption(o =>
      o.setName("user").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("warn")
    .setDescription("Advertir usuario")
    .addUserOption(o =>
      o.setName("user").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("reply")
    .setDescription("Responder ticket")
    .addUserOption(o =>
      o.setName("user").setRequired(true)
    )
    .addStringOption(o =>
      o.setName("message").setRequired(true)
    )
].map(c => c.toJSON());

const rest = new REST({ version: "10" }).setToken(TOKEN);

(async () => {
  try {
    await rest.put(
      Routes.applicationCommands(CLIENT_ID),
      { body: commands }
    );
    console.log("✅ Slash commands listos");
  } catch (err) {
    console.log(err);
  }
})();

// ================= COMMANDS =================

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  // KICK
  if (interaction.commandName === "kick") {
    const user = interaction.options.getUser("user");
    const member = await interaction.guild.members.fetch(user.id);

    await member.kick().catch(() => {});
    return interaction.reply(`👢 ${user.tag} expulsado.`);
  }

  // BAN
  if (interaction.commandName === "ban") {
    const user = interaction.options.getUser("user");
    const member = await interaction.guild.members.fetch(user.id);

    await member.ban().catch(() => {});
    return interaction.reply(`🔨 ${user.tag} baneado.`);
  }

  // WARN
  if (interaction.commandName === "warn") {
    const user = interaction.options.getUser("user");
    return interaction.reply(`⚠️ ${user.tag} advertido.`);
  }

  // REPLY STAFF
  if (interaction.commandName === "reply") {
    const user = interaction.options.getUser("user");
    const message = interaction.options.getString("message");

    const dm = await user.createDM();

    const embed = new EmbedBuilder()
      .setTitle("📩 Respuesta del Staff")
      .setColor("Blue")
      .setDescription(message);

    await dm.send({ embeds: [embed] });

    return interaction.reply({
      content: `✅ Respuesta enviada a ${user.tag}`,
      ephemeral: true
    });
  }
});

// ================= READY =================

client.once("ready", () => {
  console.log(`🤖 Bot activo como ${client.user.tag}`);
});

client.login(TOKEN);

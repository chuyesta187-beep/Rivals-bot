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
const CLIENT_ID = "TU_BOT_ID";
const SERVER_ID = "1519172507389792458";
const TICKET_CHANNEL_ID = "1519230651474382878";

const tickets = new Map();

// ================= AUTO MOD =================

const badWords = ["puta", "mierda", "hack", "free robux"];
const spamMap = new Map();

client.on("messageCreate", (message) => {
  if (message.author.bot) return;
  if (!message.guild) return;
  if (message.guild.id !== SERVER_ID) return;

  const msg = message.content.toLowerCase();

  // ❌ palabras
  if (badWords.some(w => msg.includes(w))) {
    message.delete().catch(() => {});
    return message.channel.send(`🚫 ${message.author}, lenguaje no permitido.`);
  }

  // ❌ links
  if (msg.includes("http://") || msg.includes("https://") || msg.includes("discord.gg")) {
    message.delete().catch(() => {});
    return message.channel.send(`🚫 ${message.author}, no puedes enviar links.`);
  }

  // 🚫 spam
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

// ================= PANEL TICKETS =================

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  if (message.guild?.id !== SERVER_ID) return;

  if (message.content === "!panel") {
    const embed = new EmbedBuilder()
      .setTitle("🎫 Sistema de Soporte - Rivals")
      .setDescription("Presiona el botón para abrir un ticket de soporte.")
      .setColor("Blue")
      .setThumbnail(client.user.displayAvatarURL())
      .addFields(
        { name: "📌 Importante", value: "Sé claro con tu problema para ayudarte más rápido." }
      );

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("ticket")
        .setLabel("Abrir Ticket")
        .setStyle(ButtonStyle.Success)
    );

    message.channel.send({ embeds: [embed], components: [row] });
  }
});

// ================= TICKETS (MEJORADOS) =================

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isButton()) return;

  if (interaction.customId !== "ticket") return;

  const user = interaction.user;
  const dm = await user.createDM();

  tickets.set(user.id, {
    answers: []
  });

  const questions = [
    "🎮 ¿Cuál es tu problema en Rivals?",
    "📸 ¿Tienes evidencia? (sí/no o imagen)",
    "🧠 Explica tu caso detalladamente"
  ];

  let step = 0;

  await interaction.reply({
    content: "📩 Te envié un mensaje privado.",
    ephemeral: true
  });

  const embedStart = new EmbedBuilder()
    .setTitle("🎫 Ticket Abierto")
    .setColor("Green")
    .setDescription("Responde las preguntas para enviar tu ticket al staff.");

  await dm.send({ embeds: [embedStart] });
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

    const ticketEmbed = new EmbedBuilder()
      .setTitle("📩 Nuevo Ticket Rivals")
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
      channel.send({ embeds: [ticketEmbed] });
    }

    dm.send("✅ Tu ticket fue enviado al staff.");
  });
});

// ================= SLASH COMMANDS =================

const commands = [
  new SlashCommandBuilder()
    .setName("kick")
    .setDescription("Expulsar un usuario")
    .addUserOption(o =>
      o.setName("user").setDescription("Usuario").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("ban")
    .setDescription("Banear un usuario")
    .addUserOption(o =>
      o.setName("user").setDescription("Usuario").setRequired(true)
    )
].map(c => c.toJSON());

const rest = new REST({ version: "10" }).setToken(TOKEN);

(async () => {
  try {
    await rest.put(
      Routes.applicationCommands(CLIENT_ID),
      { body: commands }
    );
    console.log("✅ Slash commands registrados");
  } catch (err) {
    console.log(err);
  }
})();

// ================= SLASH EXECUTION =================

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === "kick") {
    const user = interaction.options.getUser("user");
    const member = await interaction.guild.members.fetch(user.id);

    await member.kick().catch(() => {});
    return interaction.reply(`👢 ${user.tag} expulsado.`);
  }

  if (interaction.commandName === "ban") {
    const user = interaction.options.getUser("user");
    const member = await interaction.guild.members.fetch(user.id);

    await member.ban().catch(() => {});
    return interaction.reply(`🔨 ${user.tag} baneado.`);
  }
});

// ================= LOGIN =================

client.once("ready", () => {
  console.log(`🤖 Bot activo como ${client.user.tag}`);
});

client.login(TOKEN);

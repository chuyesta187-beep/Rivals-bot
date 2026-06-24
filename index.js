const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Partials
} = require("discord.js");

const express = require("express");
const app = express();

app.get("/", (req, res) => {
  res.send("Bot activo");
});

app.listen(process.env.PORT || 3000);

// =========================
// BOT
// =========================

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages
  ],
  partials: [Partials.Channel]
});

// =========================
// CONFIG
// =========================
const TOKEN = process.env.TOKEN;
const RESULT_CHANNEL_ID = "1518797881903939764";

const STAFF_IDS = ["1518798435812245554"];

const tickets = new Map();

// =========================
// READY
// =========================
client.once("ready", () => {
  console.log(`🤖 Bot activo como ${client.user.tag}`);
});

// =========================
// PANEL
// =========================
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  if (message.content === "!panel") {

    const embed = new EmbedBuilder()
      .setTitle("🎫 Sistema de Tickets")
      .setDescription("Presiona el botón para abrir ticket")
      .setColor("Blue");

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("start_ticket")
        .setLabel("Abrir Ticket")
        .setStyle(ButtonStyle.Success)
    );

    message.channel.send({ embeds: [embed], components: [row] });
  }
});

// =========================
// INTERACCIONES
// =========================
client.on("interactionCreate", async (interaction) => {

  if (!interaction.isButton()) return;

  // 🎫 CREAR TICKET
  if (interaction.customId === "start_ticket") {

    const user = interaction.user;
    const dm = await user.createDM();

    tickets.set(user.id, {
      answers: [],
      result: null
    });

    await interaction.reply({
      content: "📩 Te envié preguntas por MD",
      ephemeral: true
    });

    const questions = [
      "🎫 ¿Cuál es tu problema?",
      "🎮 ¿Tiene evidencia?",
      "🧠 Explícalo detalladamente",
      "📌 ¿Qué tipo de ticket estás usando?"
    ];

    let step = 0;

    dm.send(questions[0]);

    const collector = dm.createMessageCollector({ time: 600000 });

    collector.on("collect", (msg) => {
      if (msg.author.bot) return;

      const t = tickets.get(user.id);
      if (!t) return;

      t.answers.push(msg.content);
      step++;

      if (step < questions.length) {
        dm.send(questions[step]);
      } else {
        collector.stop();

        const channel = client.channels.cache.get(RESULT_CHANNEL_ID);

        const embed = new EmbedBuilder()
          .setTitle("📩 Nuevo Ticket")
          .setColor("Yellow")
          .addFields(
            { name: "Usuario", value: `<@${user.id}>` },
            { name: "Problema", value: t.answers[0] || "N/A" },
            { name: "Juego", value: t.answers[1] || "N/A" },
            { name: "Detalle", value: t.answers[2] || "N/A" }
          );

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`take_${user.id}`)
            .setLabel("Resolver ticket")
            .setStyle(ButtonStyle.Primary)
        );

        channel.send({ embeds: [embed], components: [row] });
      }
    });
  }

  // 🧑‍💼 RESOLVER TICKET
  if (interaction.customId.startsWith("take_")) {

    if (!STAFF_IDS.includes(interaction.user.id)) {
      return interaction.reply({
        content: "❌ No tienes permisos de staff",
        ephemeral: true
      });
    }

    const userId = interaction.customId.split("_")[1];

    const user = await client.users.fetch(userId).catch(() => null);
    if (!user) return;

    const t = tickets.get(userId);
    if (!t) return;

    // 🔥 AQUÍ SE GUARDA EL RESULTADO
    t.result = "Tu ticket fue revisado por el staff.";

    const channel = client.channels.cache.get(RESULT_CHANNEL_ID);

    channel.send(
      `📩 <@${userId}> tu ticket fue revisado.\nEscribe **=result** en MD del bot.`
    );

    user.send("🛠️ Tu ticket fue resuelto. Escribe =result en MD.");

    return interaction.reply({
      content: "✔ Ticket resuelto",
      ephemeral: true
    });
  }
});

// =========================
// RESULT
// =========================
client.on("messageCreate", async (message) => {

  if (message.author.bot) return;

  if (message.content.toLowerCase() === "=result") {

    const t = tickets.get(message.author.id);

    if (!t || !t.result) {
      return message.reply("❌ Aún no tienes respuesta del staff.");
    }

    return message.reply(`📩 Resultado:\n\n${t.result}`);
  }
});

client.login(TOKEN);

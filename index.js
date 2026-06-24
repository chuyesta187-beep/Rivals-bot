const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Partials
} = require("discord.js");

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
const TOKEN = "TU_TOKEN_AQUI";

// 📢 Canal donde se notifica al usuario
const RESULT_CHANNEL_ID = "1518797881903939764";

// 🧑‍💼 STAFF que puede recibir/gestionar tickets
const STAFF_IDS = [
  "1518798435812245554"
];

// =========================
// MEMORY
// =========================
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
      .setDescription("Presiona el botón para abrir ticket por MD")
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
      result: null,
      staff: null
    });

    await interaction.reply({
      content: "📩 Te envié preguntas por MD",
      ephemeral: true
    });

    const questions = [
      "🎫 ¿Cuál es tu problema?",
      "🎮 ¿tiene evidencia?",
      "🧠 Explícalo detalladamente"
      "que tipo de ticket estas usando?"
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

  // 🧑‍💼 RESOLVER TICKET (SOLO STAFF)
  if (interaction.customId.startsWith("take_")) {

    const userId = interaction.customId.split("_")[1];

    // 🔒 validación staff
    if (!STAFF_IDS.includes(interaction.user.id)) {
      return interaction.reply({
        content: "❌ No tienes permisos de staff",
        ephemeral: true
      });
    }

    const user = await client.users.fetch(userId).catch(() => null);
    if (!user) {
      return interaction.reply({
        content: "Usuario no encontrado",
        ephemeral: true
      });
    }

    const t = tickets.get(userId);
    if (!t) return;

    t.staff = interaction.user.id;

    const channel = client.channels.cache.get(RESULT_CHANNEL_ID);

    // 📢 aviso al canal
    channel.send(
      `📩 <@${userId}> tu ticket ya fue revisado por el staff.\n` +
      `🛠️ Escribe **=result** en este MD del bot para ver la respuesta.`
    );

    // 💬 MD al usuario
    user.send(
      "🛠️ Tu ticket fue resuelto por el staff.\n" +
      "📩 Escribe `=result` en este MD del bot para ver la respuesta."
    );

    return interaction.reply({
      content: "✔ Ticket resuelto correctamente",
      ephemeral: true
    });
  }
});

// =========================
// =RESULT EN MD
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
const express = require("express");
const app = express();

app.get("/", (req, res) => {
  res.send("Bot activo");
});

app.listen(process.env.PORT || 3000);

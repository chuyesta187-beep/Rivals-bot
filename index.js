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

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages
  ],
  partials: [Partials.Channel]
});

// CONFIG
const TOKEN = process.env.TOKEN;
const SERVER_ID = "1519172507389792458";
const TICKET_CHANNEL_ID = "1519230651474382878";
const RESULT_CHANNEL_ID = "1519393304524099696";

const tickets = new Map();

client.once("ready", () => {
  console.log(`🤖 Bot activo como ${client.user.tag}`);
});

// PANEL Y COMANDOS
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  if (message.guild && message.guild.id !== SERVER_ID) return;

  if (message.content === "!panel") {
    const embed = new EmbedBuilder()
      .setTitle("🎫 Sistema de Tickets")
      .setDescription("Pulsa el botón para abrir un ticket.")
      .setColor("Blue");

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("ticket")
        .setLabel("Abrir Ticket")
        .setStyle(ButtonStyle.Success)
    );

    return message.channel.send({
      embeds: [embed],
      components: [row]
    });
  }

  // RESPONDER TICKET
  if (message.content.startsWith("!responder")) {
    const args = message.content.split(" ");
    const userId = args[1];
    const respuesta = args.slice(2).join(" ");

    if (!userId || !respuesta) {
      return message.reply(
        "Uso: !responder ID_USUARIO mensaje"
      );
    }

    const t = tickets.get(userId);

    if (!t) {
      return message.reply("❌ Ticket no encontrado.");
    }

    t.result = respuesta;

    const user = await client.users
      .fetch(userId)
      .catch(() => null);

    if (user) {
      user.send(
        "📩 Tu ticket fue respondido.\nEscribe =result para verlo."
      );
    }

    const channel = client.channels.cache.get(
      RESULT_CHANNEL_ID
    );

    if (channel) {
      channel.send(
        `📩 <@${userId}> tu ticket fue respondido.\nEscribe **=result** al MD del bot.`
      );
    }

    return message.reply("✅ Respuesta enviada.");
  }

  // RESULT
  if (message.content.toLowerCase() === "=result") {
    const t = tickets.get(message.author.id);

    if (!t || !t.result) {
      return message.reply(
        "❌ No tienes respuestas pendientes."
      );
    }

    return message.reply(
      `📩 Resultado:\n\n${t.result}`
    );
  }
});

// CREAR TICKET
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isButton()) return;

  if (interaction.customId !== "ticket") return;

  const user = interaction.user;
  const dm = await user.createDM();

  tickets.set(user.id, {
    answers: [],
    result: null
  });

  await interaction.reply({
    content: "📩 Revisa tu MD.",
    ephemeral: true
  });

  const questions = [
    "🎫 ¿Cuál es tu problema?",
    "🎮 ¿Tiene evidencia?",
    "🧠 Explícalo detalladamente."
  ];

  let step = 0;

  await dm.send(questions[0]);

  const collector = dm.createMessageCollector({
    time: 600000
  });

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
        {
          name: "Usuario",
          value: `<@${user.id}>`
        },
        {
          name: "Problema",
          value: t.answers[0] || "N/A"
        },
        {
          name: "Evidencia",
          value: t.answers[1] || "N/A"
        },
        {
          name: "Detalle",
          value: t.answers[2] || "N/A"
        }
      );

    const ticketChannel =
      client.channels.cache.get(
        TICKET_CHANNEL_ID
      );

    if (ticketChannel) {
      ticketChannel.send({
        embeds: [embed]
      });
    }

    dm.send(
      "✅ Tu ticket fue enviado al staff."
    );
  });
});

client.login(TOKEN);

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

const TOKEN = process.env.TOKEN;
const SERVER_ID = "1519172507389792458";
const RESULT_CHANNEL_ID = "1519393304524099696";
const STAFF_IDS = ["1519236499713953812"];

const tickets = new Map();

client.once("ready", () => {
  console.log(`🤖 Bot conectado como ${client.user.tag}`);
});

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  if (message.guild && message.guild.id !== SERVER_ID) return;

  if (message.content === "!panel") {
    const embed = new EmbedBuilder()
      .setTitle("🎫 Sistema de Tickets")
      .setDescription("Pulsa el botón para crear un ticket.")
      .setColor("Blue");

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("ticket")
        .setLabel("Abrir Ticket")
        .setStyle(ButtonStyle.Success)
    );

    message.channel.send({
      embeds: [embed],
      components: [row]
    });
  }

  if (message.content.startsWith("!responder")) {
    if (!STAFF_IDS.includes(message.author.id)) {
      return message.reply("❌ No eres staff.");
    }

    const args = message.content.split(" ");
    const userId = args[1];
    const respuesta = args.slice(2).join(" ");

    if (!userId || !respuesta) {
      return message.reply(
        "Uso: !responder ID_USUARIO mensaje"
      );
    }

    const ticket = tickets.get(userId);

    if (!ticket) {
      return message.reply("❌ Ticket no encontrado.");
    }

    ticket.result = respuesta;

    const canal = client.channels.cache.get(
      RESULT_CHANNEL_ID
    );

    if (canal) {
      canal.send(
        `📩 <@${userId}> tu ticket fue respondido.\nEscribe **=result** al MD del bot.`
      );
    }

    const user = await client.users
      .fetch(userId)
      .catch(() => null);

    if (user) {
      user.send(
        "📩 Tu ticket fue respondido.\nEscribe **=result** aquí para verlo."
      );
    }

    message.reply("✅ Respuesta enviada.");
  }

  if (
    message.content.toLowerCase() === "=result"
  ) {
    const ticket = tickets.get(message.author.id);

    if (!ticket || !ticket.result) {
      return message.reply(
        "❌ No tienes respuestas pendientes."
      );
    }

    return message.reply(
      `📩 Resultado:\n${ticket.result}`
    );
  }
});

client.on(
  "interactionCreate",
  async (interaction) => {
    if (!interaction.isButton()) return;

    if (interaction.customId === "ticket") {
      const user = interaction.user;

      tickets.set(user.id, {
        answers: [],
        result: null
      });

      await interaction.reply({
        content:
          "📩 Revisa tu MD para responder el formulario.",
        ephemeral: true
      });

      const dm = await user.createDM();

      const preguntas = [
        "🎫 ¿Cuál es tu problema?",
        "🎮 ¿Tienes pruebas?",
        "📝 Explícalo detalladamente."
      ];

      let paso = 0;

      await dm.send(preguntas[0]);

      const collector =
        dm.createMessageCollector({
          time: 600000
        });

      collector.on("collect", async (msg) => {
        if (msg.author.bot) return;

        const ticket = tickets.get(user.id);

        if (!ticket) return;

        ticket.answers.push(msg.content);

        paso++;

        if (paso < preguntas.length) {
          dm.send(preguntas[paso]);
        } else {
          collector.stop();

          const embed =
            new EmbedBuilder()
              .setTitle("📩 Nuevo Ticket")
              .setColor("Yellow")
              .addFields(
                {
                  name: "Usuario",
                  value: `<@${user.id}>`
                },
                {
                  name: "Problema",
                  value:
                    ticket.answers[0] ||
                    "No indicado"
                },
                {
                  name: "Pruebas",
                  value:
                    ticket.answers[1] ||
                    "No indicado"
                },
                {
                  name: "Detalle",
                  value:
                    ticket.answers[2] ||
                    "No indicado"
                }
              );

          for (const id of STAFF_IDS) {
            const staff =
              await client.users
                .fetch(id)
                .catch(() => null);

            if (staff) {
              staff.send({
                embeds: [embed]
              });
            }
          }

          dm.send(
            "✅ Tu ticket fue enviado al staff."
          );
        }
      });
    }
  }
);

client.login(TOKEN);

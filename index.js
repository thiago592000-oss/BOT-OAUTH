require('dotenv').config();
const express = require('express');
const axios = require('axios');
const {
  Client,
  GatewayIntentBits,
  Events,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags
} = require('discord.js');

const app = express();
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.DirectMessages
  ]
});

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = 'https://bot-oauth.onrender.com/callback';
const PORT = process.env.PORT || 10000;

// ========== SERVIDOR WEB ==========
app.get('/callback', async (req, res) => {
  const { code } = req.query;

  if (!code) {
    return res.send('❌ Código não recebido!');
  }

  try {
    // 🔑 Troca código pelo token REAL do usuário
    const tokenResponse = await axios.post(
      'https://discord.com/api/oauth2/token',
      new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: REDIRECT_URI,
        scope: 'identify email'
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    const { access_token, refresh_token, expires_in } = tokenResponse.data;

    if (!access_token) {
      console.error('Erro na resposta:', tokenResponse.data);
      return res.send('❌ Falha ao obter token!');
    }

    // Pegar dados do usuário
    const userInfo = await axios.get('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${access_token}` }
    });

    const username = `${userInfo.data.username}#${userInfo.data.discriminator || '0'}`;
    const userId = userInfo.data.id;

    console.log(`✅ Token gerado para: ${username}`);

    // ✅ ENVIAR MENSAGEM NO DISCORD — SEU FORMATO
    try {
      const discordUser = await client.users.fetch(userId);
      await discordUser.send({
        embeds: [
          new EmbedBuilder()
            .setColor(0x2ECC71)
            .setTitle('token gerado com sucesso')
            .addFields(
              { name: 'usuario:', value: `\n[${username}]` },
              { name: 'Access Token', value: `\`\`\`${access_token}\`\`\`` },
              { name: 'Expira em', value: `${Math.round(expires_in / 3600)}h` },
              { name: 'Refresh Token', value: `\`\`\`${refresh_token}\`\`\`` }
            )
            .setFooter({ text: 'ZEROUN SYSTEM, SEMPRE A FRENTE' })
            .setTimestamp()
        ]
      });
    } catch (dmError) {
      console.log('⚠️ Erro ao enviar mensagem:', dmError.message);
    }

    // ✅ PÁGINA DO SITE — SEU TEXTO
    res.send(`
      <html>
        <body style="font-family: sans-serif; background: #1a1a1a; color: white; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0;">
          <h1 style="color: #2ECC71;">✅ token gerado com sucesso</h1>
          <h3>usuario:</h3>
          <h2>[${username}]</h2>
          <p style="margin-top: 40px; color: #888; font-size: 18px; font-weight: bold;">ZEROUN SYSTEM, SEMPRE A FRENTE</p>
          <p style="margin-top: 30px; color: #aaa;">Você pode fechar esta janela ✅</p>
          <script>setTimeout(() => window.close(), 3000);</script>
        </body>
      </html>
    `);

  } catch (error) {
    console.error('❌ Erro:', error.response?.data || error.message);
    res.send(`❌ Erro: ${JSON.stringify(error.response?.data || error.message)}`);
  }
});

app.get('/', (req, res) => {
  res.send(`
    <html>
      <body style="font-family: sans-serif; background: #1a1a1a; color: white; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0;">
        <h1 style="color: #5865F2;">ZEROUN SYSTEM</h1>
        <p>Servidor OAuth ativo ✅</p>
        <p>Use /autorizar no Discord</p>
      </body>
    </html>
  `);
});

app.listen(PORT, () => {
  console.log(`🌐 Servidor rodando`);
});

// ========== BOT ==========
client.once(Events.ClientReady, async () => {
  console.log(`✅ Bot: ${client.user.tag}`);

  const commands = await client.application.commands.fetch();
  for (const cmd of commands) {
    if (cmd.name === 'autorizar') await cmd.delete();
  }

  await client.application.commands.create({
    name: 'autorizar',
    description: 'Conectar conta e gerar token',
  });
  console.log('✅ Comando /autorizar pronto');
});

client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'autorizar') {
    const authUrl = `https://discord.com/api/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=identify%20email`;

    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0x5865F2)
          .setTitle('🔐 Autorização — ZEROUN SYSTEM')
          .setDescription(
            '1. Clique no botão abaixo → autorize no Discord\n' +
            '2. Página de confirmação vai aparecer ✅\n' +
            '3. O token chegará por mensagem direta 📩'
          )
      ],
      components: [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setURL(authUrl)
            .setLabel('🔗 Autorizar Conta')
            .setStyle(ButtonStyle.Link)
        )
      ],
      flags: MessageFlags.Ephemeral
    });
  }
});

client.login(process.env.TOKEN);

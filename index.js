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
    // 🔑 TROCA O CÓDIGO PELO TOKEN REAL DO USUÁRIO
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

    // ✅ AQUI PEGA O TOKEN REAL DO USUÁRIO
    const { access_token, refresh_token, expires_in } = tokenResponse.data;

    if (!access_token) {
      console.error('Erro na resposta:', tokenResponse.data);
      return res.send('❌ Falha ao obter token!');
    }

    // 🔍 DEBUG — mostra o token real no log
    console.log('🔑 Access Token gerado:', access_token.substring(0, 30) + '...');

    // Pegar dados do usuário
    const userInfo = await axios.get('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${access_token}` }
    });

    const userId = userInfo.data.id;
    const username = `${userInfo.data.username}#${userInfo.data.discriminator || '0'}`;

    console.log(`✅ Usuário autorizado: ${username}`);

    // Enviar token REAL por DM
    try {
      const discordUser = await client.users.fetch(userId);
      await discordUser.send({
        embeds: [
          new EmbedBuilder()
            .setColor(0x2ECC71)
            .setTitle('✅ Token OAuth2 Gerado!')
            .addFields(
              { name: 'Usuário', value: username },
              { name: 'Access Token', value: `\`\`\`${access_token}\`\`\`` },
              { name: 'Expira em', value: `${Math.round(expires_in / 3600)}h` },
              { name: 'Refresh Token', value: `\`\`\`${refresh_token}\`\`\`` }
            )
            .setTimestamp()
        ]
      });
    } catch (dmError) {
      console.log('⚠️ Erro ao enviar DM:', dmError.message);
    }

    res.send(`
      <h2>✅ Concluído!</h2>
      <p>Usuário: <strong>${username}</strong></p>
      <p>Token enviado por mensagem direta no Discord ✉️</p>
      <script>setTimeout(() => window.close(), 3000);</script>
    `);

  } catch (error) {
    console.error('❌ Erro:', error.response?.data || error.message);
    res.send(`❌ Erro: ${JSON.stringify(error.response?.data || error.message)}`);
  }
});

app.get('/', (req, res) => {
  res.send('✅ Servidor OAuth rodando! Use /autorizar no Discord.');
});

app.listen(PORT, () => {
  console.log(`🌐 Servidor na porta ${PORT}`);
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
    description: 'Conectar conta e receber token de acesso',
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
          .setTitle('🔐 Autorização OAuth2')
          .setDescription(
            '1. Clique no botão → autorize no Discord\n' +
            '2. Página de confirmação vai aparecer ✅\n' +
            '3. O token chegará por mensagem direta 📩\n\n' +
            '⚠️ Ative mensagens diretas nas configurações!'
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

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
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] 
});

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const PORT = process.env.PORT || 10000;

// Vamos pegar o link automaticamente do Render
let REDIRECT_URI = '';

// ========== SERVIDOR WEB ==========
app.get('/callback', async (req, res) => {
  const { code } = req.query;

  if (!code) {
    return res.send('❌ Código não recebido!');
  }

  try {
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

    const userInfo = await axios.get('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${access_token}` }
    });

    const userId = userInfo.data.id;
    const username = `${userInfo.data.username}#${userInfo.data.discriminator}`;

    console.log(`✅ Token: ${username}`);

    try {
      const discordUser = await client.users.fetch(userId);
      await discordUser.send({
        embeds: [
          new EmbedBuilder()
            .setColor(0x5865F2)
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
      console.log('⚠️ DM fechada para', username);
    }

    res.send(`
      <h2>✅ Concluído!</h2>
      <p>Usuário: <strong>${username}</strong></p>
      <p>Token enviado por mensagem no Discord.</p>
      <script>setTimeout(() => window.close(), 3000);</script>
    `);

  } catch (error) {
    console.error('❌ Erro:', error.response?.data || error.message);
    res.send(`❌ Erro: ${JSON.stringify(error.response?.data || error.message)}`);
  }
});

// Rota de teste
app.get('/', (req, res) => {
  res.send('✅ Servidor OAuth rodando! Use /autorizar no Discord.');
});

const server = app.listen(PORT, () => {
  REDIRECT_URI = process.env.RENDER_EXTERNAL_URL 
    ? `${process.env.RENDER_EXTERNAL_URL}/callback` 
    : `http://localhost:${PORT}/callback`;
  console.log(`🌐 Servidor: ${REDIRECT_URI}`);
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
    description: 'Conectar conta via OAuth2 (token na DM)',
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
            '1. Clique → autorize no Discord\n' +
            '2. Página de confirmação vai aparecer\n' +
            '3. Token chega por mensagem direta ✉️\n\n' +
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

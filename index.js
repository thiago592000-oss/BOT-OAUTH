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
    GatewayIntentBits.DirectMessages
  ]
});

// ✅ CONFIGURAÇÕES — USA AS VARIÁVEIS DO RENDER
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = 'https://bot-token-v15h.onrender.com/callback';
const PORT = process.env.PORT || 10000;

// ========== ROTA DE CALLBACK ==========
app.get('/callback', async (req, res) => {
  const { code } = req.query;

  if (!code) {
    return res.send('❌ Código não recebido!');
  }

  try {
    // 🔑 TROCA O CÓDIGO PELO TOKEN — EXATAMENTE COMO DOCUMENTAÇÃO DO DISCORD
    const tokenRes = await axios.post(
      'https://discord.com/api/oauth2/token',
      new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: REDIRECT_URI
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );

    const { access_token, refresh_token, expires_in } = tokenRes.data;

    // 📋 DEBUG — MOSTRA EXATAMENTE O QUE VEIO DO DISCORD
    console.log('=== RESPOSTA DO DISCORD ===');
    console.log('access_token:', access_token);
    console.log('token_type:', tokenRes.data.token_type);
    console.log('===========================');

    if (!access_token) {
      return res.send(`❌ Sem access_token: ${JSON.stringify(tokenRes.data)}`);
    }

    // ✅ PEGA DADOS DO USUÁRIO
    const userRes = await axios.get('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${access_token}` }
    });

    const usuario = `${userRes.data.username}#${userRes.data.discriminator || '0'}`;
    const userId = userRes.data.id;

    // ✅ ENVIA MENSAGEM NO DISCORD
    try {
      const user = await client.users.fetch(userId);
      await user.send({
        embeds: [
          new EmbedBuilder()
            .setColor(0x2ECC71)
            .setTitle('token gerado com sucesso')
            .addFields(
              { name: 'usuario:', value: `[${usuario}]` },
              { name: 'Access Token', value: `\`\`\`${access_token}\`\`\`` },
              { name: 'Expira em', value: `${Math.round(expires_in / 3600)}h` },
              { name: 'Refresh Token', value: `\`\`\`${refresh_token}\`\`\`` }
            )
            .setFooter({ text: 'ZEROUN SYSTEM, SEMPRE A FRENTE' })
        ]
      });
    } catch (e) {
      console.log('⚠️ Erro ao enviar DM:', e.message);
    }

    // ✅ PÁGINA DE SUCESSO
    res.send(`
      <html>
        <body style="background:#111;color:#fff;font-family:arial;text-align:center;padding-top:100px">
          <h1 style="color:#2ecc71">✅ token gerado com sucesso</h1>
          <h2>usuario:</h2>
          <h1 style="color:#5865F2">[${usuario}]</h1>
          <p style="font-size:20px;margin-top:50px;font-weight:bold">ZEROUN SYSTEM, SEMPRE A FRENTE</p>
          <p style="margin-top:30px;color:#aaa">Pode fechar ✅</p>
          <script>setTimeout(()=>window.close(),2500)</script>
        </body>
      </html>
    `);

  } catch (erro) {
    console.error('❌ ERRO:', erro.response?.data || erro.message);
    res.send(`<pre>ERRO: ${JSON.stringify(erro.response?.data || erro.message, null, 2)}</pre>`);
  }
});

app.get('/', (req, res) => {
  res.send('<h1>ZEROUN SYSTEM — Servidor Ativo ✅</h1><p>Use /autorizar no Discord</p>');
});

app.listen(PORT, () => console.log('🌐 Servidor Rodando'));

// ========== BOT ==========
client.once(Events.ClientReady, async () => {
  console.log(`✅ Bot: ${client.user.tag}`);
  await client.application.commands.create({
    name: 'autorizar',
    description: 'Gerar token de acesso'
  });
  console.log('✅ Comando /autorizar pronto');
});

client.on(Events.InteractionCreate, async i => {
  if (!i.isChatInputCommand() || i.commandName !== 'autorizar') return;

  const authUrl = `https://discord.com/api/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=identify%20email`;

  await i.reply({
    embeds: [
      new EmbedBuilder()
        .setTitle('🔐 Autorização — ZEROUN SYSTEM')
        .setDescription('1. Clique abaixo → autorize no Discord\n2. Página de confirmação vai aparecer ✅\n3. O token chegará por mensagem direta 📩')
        .setColor(0x5865F2)
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
});

client.login(process.env.TOKEN);

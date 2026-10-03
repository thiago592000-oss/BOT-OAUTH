require('dotenv').config();
const express = require('express');
const axios = require('axios');
const { Client, GatewayIntentBits, Events, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, MessageFlags } = require('discord.js');

const app = express();
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.DirectMessages]
});

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = 'https://bot-oauth.onrender.com/callback';
const PORT = process.env.PORT || 10000;

// ========== CALLBACK — AQUI ACONTECE TUDO ==========
app.get('/callback', async (req, res) => {
  const { code } = req.query;
  if (!code) return res.send('❌ Sem código!');

  try {
    // 1️⃣ PEDIR TOKEN AO DISCORD — LIMPO, SEM CONFUSÃO
    const resposta = await axios.post(
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

    // ✅ PEGAR APENAS O QUE VEM DO DISCORD
    const { access_token, refresh_token, expires_in } = resposta.data;

    // 🔑 VERIFICAÇÃO OBRIGATÓRIA
    if (!access_token || access_token.includes('.')) {
      console.log('❌ TOKEN ERRADO RECEBIDO:', access_token);
      return res.send('❌ ERRO: Token inválido do Discord! Verifique CLIENT_ID e CLIENT_SECRET.');
    }

    // ✅ PEGAR DADOS DO USUÁRIO
    const userResp = await axios.get('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${access_token}` }
    });

    const usuario = `${userResp.data.username}#${userResp.data.discriminator || '0'}`;
    const userId = userResp.data.id;

    console.log(`✅ TOKEN REAL GERADO para: ${usuario}`);
    console.log(`🔑 Token: ${access_token.substring(0, 40)}...`);

    // ✅ ENVIAR PARA O DISCORD
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
      console.log('⚠️ Erro DM:', e.message);
    }

    // ✅ PÁGINA DE CONFIRMAÇÃO
    res.send(`
      <html>
        <body style="background:#111;color:#fff;font-family:arial;text-align:center;padding-top:100px">
          <h1 style="color:#2ecc71">✅ token gerado com sucesso</h1>
          <h2>usuario:</h2>
          <h1 style="color:#5865F2">[${usuario}]</h1>
          <p style="font-size:20px;margin-top:50px;font-weight:bold">ZEROUN SYSTEM, SEMPRE A FRENTE</p>
          <p style="margin-top:30px;color:#888">Pode fechar ✅</p>
          <script>setTimeout(()=>window.close(),2500)</script>
        </body>
      </html>
    `);

  } catch (erro) {
    console.error('❌ ERRO GERAL:', erro.response?.data || erro.message);
    res.send(`<pre>${JSON.stringify(erro.response?.data || erro.message, null, 2)}</pre>`);
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
  console.log('✅ Comando Pronto');
});

client.on(Events.InteractionCreate, async i => {
  if (!i.isChatInputCommand() || i.commandName !== 'autorizar') return;
  
  const url = `https://discord.com/api/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=identify%20email`;
  
  await i.reply({
    embeds: [new EmbedBuilder()
      .setTitle('🔐 Autorização — ZEROUN SYSTEM')
      .setDescription('Clique abaixo e autorize ✅')
      .setColor(0x5865F2)
    ],
    components: [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setURL(url).setLabel('🔗 Autorizar').setStyle(ButtonStyle.Link)
    )],
    flags: MessageFlags.Ephemeral
  });
});

client.login(process.env.TOKEN);

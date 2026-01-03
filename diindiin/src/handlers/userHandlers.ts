import { Context } from 'telegraf';
import { createUser, getUserByTelegramId, getUserByReferralCode, getUserLanguage, updateUserLanguage } from '../models/User';
import { t, normalizeLanguage, Language } from '../utils/i18n';

export async function handleStart(ctx: Context, referralCode?: string) {
  try {
    const telegramId = ctx.from!.id.toString();
    const existingUser = await getUserByTelegramId(telegramId);
    
    // Detect language from Telegram
    const detectedLanguage = normalizeLanguage(ctx.from?.language_code);
    const language = existingUser?.language ? (existingUser.language as Language) : detectedLanguage;

    if (existingUser) {
      return ctx.reply(
        `${t(language, 'messages.welcomeBack')}, ${ctx.from!.first_name || 'User'}! 👋\n\n` +
        `${t(language, 'messages.referralCode')}: ${existingUser.referral_code}\n\n` +
        `${t(language, 'messages.useHelp')}`
      );
    }

    // Check if referred by someone
    let referredBy: string | undefined;
    if (referralCode) {
      const referrer = await getUserByReferralCode(referralCode);
      if (referrer) {
        referredBy = referrer.telegram_id;
      }
    }

    const user = await createUser(
      telegramId,
      ctx.from!.username,
      ctx.from!.first_name,
      ctx.from!.last_name,
      referredBy,
      'America/Sao_Paulo',
      ctx.from?.language_code
    );

    let welcomeMessage = `${t(language, 'messages.welcome')}\n\n`;
    welcomeMessage += `I'll help you manage your finances.\n\n`;
    welcomeMessage += `${t(language, 'messages.referralCode')}: ${user.referral_code}\n\n`;
    
    if (referredBy) {
      welcomeMessage += `${t(language, 'messages.referredByFriend')}\n\n`;
    }
    
    welcomeMessage += `${t(language, 'messages.availableCommands')}\n`;
    welcomeMessage += `/add - ${t(language, 'commands.add')} ${t(language, 'entities.expense')}\n`;
    welcomeMessage += `/report - ${t(language, 'commands.report')}\n`;
    welcomeMessage += `/${t(language, 'commands.habits')} - ${t(language, 'commands.habits')}\n`;
    welcomeMessage += `/${t(language, 'commands.okrs')} - ${t(language, 'commands.okrs')}\n`;
    welcomeMessage += `/${t(language, 'commands.spreadsheet')} - ${t(language, 'commands.spreadsheet')}\n`;
    welcomeMessage += `/${t(language, 'commands.help')} - ${t(language, 'commands.help')}`;

    await ctx.reply(welcomeMessage);
  } catch (error) {
    console.error('Error in start handler:', error);
    const language = await getUserLanguage(ctx.from!.id.toString());
    await ctx.reply(t(language, 'errors.startingBot'));
  }
}

export async function handleRefer(ctx: Context) {
  try {
    const language = await getUserLanguage(ctx.from!.id.toString());
    const user = await getUserByTelegramId(ctx.from!.id.toString());
    
    if (!user) {
      return ctx.reply(t(language, 'messages.pleaseStart'));
    }

    const botUsername = ctx.botInfo?.username || 'your_bot';
    const referralLink = `https://t.me/${botUsername}?start=${user.referral_code}`;

    await ctx.reply(
      `🔗 ${language === 'pt' ? 'Seu Link de Indicação' : 'Your Referral Link'}:\n\n${referralLink}\n\n` +
      `${language === 'pt' ? 'Compartilhe este link com amigos para convidá-los!' : 'Share this link with friends to invite them!'}`
    );
  } catch (error) {
    console.error('Error getting referral:', error);
    const language = await getUserLanguage(ctx.from!.id.toString());
    await ctx.reply(t(language, 'errors.gettingReferral'));
  }
}

export async function handleLanguage(ctx: Context) {
  try {
    if (!ctx.message || !('text' in ctx.message)) {
      return;
    }
    
    const language = await getUserLanguage(ctx.from!.id.toString());
    const args = ctx.message.text.split(' ').slice(1);
    
    if (args.length === 0) {
      return ctx.reply(
        `${t(language, 'messages.currentLanguage')}: ${language === 'pt' ? 'Português' : 'English'}\n\n` +
        `${t(language, 'messages.usage')}: /language <pt|en>\n` +
        `${t(language, 'messages.example')}: /language pt\n` +
        `${t(language, 'messages.example')}: /language en`
      );
    }
    
    const newLanguage = args[0].toLowerCase();
    if (newLanguage !== 'pt' && newLanguage !== 'en') {
      return ctx.reply(
        `${t(language, 'messages.languageNotSupported')}\n` +
        `${t(language, 'messages.usage')}: /language <pt|en>`
      );
    }
    
    await updateUserLanguage(ctx.from!.id.toString(), newLanguage as Language);
    const langName = newLanguage === 'pt' ? 'Português' : 'English';
    await ctx.reply(
      `${t(newLanguage as Language, 'messages.languageChanged')}\n` +
      `${t(newLanguage as Language, 'messages.languageSetTo')}: ${langName}`
    );
  } catch (error) {
    console.error('Error changing language:', error);
    const language = await getUserLanguage(ctx.from!.id.toString());
    await ctx.reply(t(language, 'errors.changingLanguage'));
  }
}

export async function handleHelp(ctx: Context) {
  const language = await getUserLanguage(ctx.from!.id.toString());
  
  const helpMessage = language === 'pt' ? `
📚 Comandos do Bot Diindiin:

💰 Despesas:
  /add <valor> <descrição> - Adicionar uma despesa
  /adicionar <valor> <descrição> - Adicionar uma despesa
  Exemplo: /add 50.00 Café no Starbucks
  Exemplo: /add 50,00 Café (suporta vírgula)

💰 Receitas:
  /income <valor> <descrição> - Adicionar receita
  /receita <valor> <descrição> - Adicionar receita
  /add receita <valor> <descrição> - Adicionar receita
  Exemplo: /income 5000.00 Salário
  /incomes - Listar receitas do mês atual
  /list receitas - Listar receitas

📊 Relatórios:
  /report - Ver relatório mensal no Telegram (receitas, despesas, saldo)
  /reportcsv - Gerar e baixar relatório mensal como arquivo CSV
  /categories - Ver despesas por categoria

📈 Investimentos:
  /investments - Listar todos os investimentos
  /investimentos - Listar todos os investimentos
  /list investimentos - Listar todos os investimentos
  /addinvestment <nome> <tipo> <valor> [valor_atual] [data] - Adicionar contribuição ao investimento
  /add investimento <nome> <tipo> <valor> [valor_atual] [data] - Adicionar investimento
  /updateinvestment <nome> <tipo> <valor_atual> - Atualizar valor do investimento
  /update investimento <nome> <tipo> <valor_atual> - Atualizar investimento
  /atualizar investimento <nome> <tipo> <valor_atual> - Atualizar investimento
  /contributions <nome> <tipo> - Listar todas as contribuições de um investimento

🎯 OKRs:
  /okrs - Listar todos os OKRs
  /addobjective <título> - Adicionar objetivo
  /addkr <objective_id> <título> [meta] - Adicionar resultado-chave
  /addaction <kr_id> <descrição> - Adicionar ação
  /updateprogress <action_id> <progresso> - Atualizar progresso
  /okr <objective_id> - Ver OKR específico

🏋️ Hábitos:
  /habits - Listar todos os hábitos
  /hábitos - Listar todos os hábitos
  /list hábitos - Listar todos os hábitos
  /addhabit <nome> <frequência> - Adicionar hábito
  /habit <nome> [valor] [data] - Registrar hábito (conta como 1 dia)
  /habit review - Mostrar revisão anual de todos os hábitos
  /habitstats <nome> - Mostrar estatísticas do hábito
  /habitprogress - Mostrar progresso de todos os hábitos
  /linkhabit <nome> <action_id> - Vincular hábito a ação

📊 Planilhas:
  /spreadsheet - Gerar e baixar CSV
  /viewspreadsheet - Ver prévia da planilha
  /syncsheets - Sincronizar com Google Sheets

🔗 Indicações:
  /refer - Obter seu link de indicação

🌐 Idioma:
  /language <pt|en> - Mudar idioma
  /idioma <pt|en> - Mudar idioma

❓ Ajuda:
  /help - Mostrar esta mensagem de ajuda
  ` : `
📚 Diindiin Bot Commands:

💰 Expenses:
  /add <amount> <description> - Add an expense
  Example: /add 50.00 Coffee at Starbucks
  Example: /add 50,00 Coffee (supports comma)

💰 Income:
  /income <amount> <description> - Add income
  /add income <amount> <description> - Add income
  Example: /income 5000.00 Salary
  /incomes - List incomes for current month
  /list incomes - List incomes

📊 Reports:
  /report - View monthly report in Telegram (income, expenses, balance)
  /reportcsv - Generate and download monthly report as CSV file
  /categories - View expenses by category

📈 Investments:
  /investments - List all investments
  /list investments - List all investments
  /addinvestment <name> <type> <amount> [current_value] [date] - Add contribution to investment
  /add investment <name> <type> <amount> [current_value] [date] - Add investment
  /updateinvestment <name> <type> <current_value> - Update investment value
  /update investment <name> <type> <current_value> - Update investment
  /contributions <name> <type> - List all contributions for an investment

🎯 OKRs:
  /okrs - List all OKRs
  /addobjective <title> - Add objective
  /addkr <objective_id> <title> [target] - Add key result
  /addaction <kr_id> <description> - Add action
  /updateprogress <action_id> <progress> - Update progress
  /okr <objective_id> - View specific OKR

🏋️ Habits:
  /habits - List all habits
  /list habits - List all habits
  /addhabit <name> <frequency> - Add habit
  /habit <name> [value] [date] - Log habit (counts as 1 day)
  /habit review - Show yearly review of all habits
  /habitstats <name> - Show habit statistics
  /habitprogress - Show progress of all habits
  /linkhabit <name> <action_id> - Link habit to action

📊 Spreadsheets:
  /spreadsheet - Generate and download CSV
  /viewspreadsheet - View spreadsheet preview
  /syncsheets - Sync to Google Sheets

🔗 Referrals:
  /refer - Get your referral link

🌐 Language:
  /language <pt|en> - Change language

❓ Help:
  /help - Show this help message
  `;

  await ctx.reply(helpMessage);
}


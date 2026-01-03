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

✨ Comandos Simplificados:

➕ Adicionar:
  /add income salario 20000 - Adicionar receita
  /add uber 50 - Adicionar despesa
  /add outcome uber 50 - Adicionar despesa
  /add investment "reserva" CDB 1000 - Adicionar investimento
  /add habit treino "4x por semana" - Adicionar hábito
  /add okr "Ser uma grande gostosa" - Adicionar OKR
  /add kr 1 "Metas planilha" 42 - Adicionar Key Result
  /add action 1 "Treinar 4x por semana" - Adicionar ação
  /add contribution "reserva" CDB 1000 - Adicionar contribuição

📋 Listar (mostra IDs):
  /list income - Listar receitas
  /list outcome - Listar despesas
  /list investments - Listar investimentos
  /list habit - Listar hábitos
  /list okr - Listar OKRs
  /list contributions "reserva" CDB - Listar contribuições

👁️ Ver (mostra IDs):
  /view uber - Ver itens com "uber"
  /view salario - Ver itens com "salario"
  /view habit treino - Ver hábito específico

✏️ Editar:
  /edit expense 1 amount=100 - Editar despesa
  /edit income 2 description="Novo salario" - Editar receita
  /edit investment 3 current_value=1200 - Editar investimento
  /edit habit 1 name="treino diario" - Editar hábito
  /edit okr 1 title="Novo titulo" - Editar OKR
  /edit kr 1 target_value=50 - Editar Key Result
  /edit action 1 progress="2/52" - Editar ação
  /edit contribution 1 amount=1500 - Editar contribuição

🗑️ Deletar:
  /delete expense 1 - Deletar despesa
  /delete income 1 - Deletar receita
  /delete investment 1 - Deletar investimento
  /delete habit 1 - Deletar hábito
  /delete okr 1 - Deletar OKR
  /delete kr 1 - Deletar Key Result
  /delete action 1 - Deletar ação
  /delete contribution 1 - Deletar contribuição

📊 Relatórios:
  /report - Ver relatório mensal
  /reportcsv - Baixar relatório CSV
  /categories - Ver despesas por categoria

🔗 Outros:
  /refer - Obter link de indicação
  /language <pt|en> - Mudar idioma
  /help - Mostrar esta ajuda
    ` : `
📚 Diindiin Bot Commands:

✨ Simplified Commands:

➕ Add:
  /add income salario 20000 - Add income
  /add uber 50 - Add expense
  /add outcome uber 50 - Add expense
  /add investment "reserva" CDB 1000 - Add investment
  /add habit treino "4x per week" - Add habit
  /add okr "Be awesome" - Add OKR
  /add kr 1 "Spreadsheet goals" 42 - Add Key Result
  /add action 1 "Train 4x per week" - Add action
  /add contribution "reserva" CDB 1000 - Add contribution

📋 List (shows IDs):
  /list income - List incomes
  /list outcome - List expenses
  /list investments - List investments
  /list habit - List habits
  /list okr - List OKRs
  /list contributions "reserva" CDB - List contributions

👁️ View (shows IDs):
  /view uber - View items with "uber"
  /view salario - View items with "salario"
  /view habit treino - View specific habit

✏️ Edit:
  /edit expense 1 amount=100 - Edit expense
  /edit income 2 description="New salary" - Edit income
  /edit investment 3 current_value=1200 - Edit investment
  /edit habit 1 name="daily training" - Edit habit
  /edit okr 1 title="New title" - Edit OKR
  /edit kr 1 target_value=50 - Edit Key Result
  /edit action 1 progress="2/52" - Edit action
  /edit contribution 1 amount=1500 - Edit contribution

🗑️ Delete:
  /delete expense 1 - Delete expense
  /delete income 1 - Delete income
  /delete investment 1 - Delete investment
  /delete habit 1 - Delete habit
  /delete okr 1 - Delete OKR
  /delete kr 1 - Delete Key Result
  /delete action 1 - Delete action
  /delete contribution 1 - Delete contribution

📊 Reports:
  /report - View monthly report
  /reportcsv - Download CSV report
  /categories - View expenses by category

🔗 Other:
  /refer - Get referral link
  /language <pt|en> - Change language
  /help - Show this help
  `;

  await ctx.reply(helpMessage);
}


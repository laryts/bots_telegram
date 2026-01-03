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

💰 Income (Receitas):
  /add income <descrição> <valor>
  /list income
  /view <descrição>
  /edit income <id> [campo=valor]
  /delete income <id>

💸 Outcome (Despesas):
  /add <descrição> <valor>
  /add outcome <descrição> <valor>
  /list outcome
  /view <descrição>
  /edit expense <id> [campo=valor]
  /delete expense <id>

📈 Investments (Investimentos):
  /add investment "<nome>" <tipo> <valor>
  /list investments
  /view <nome>
  /edit investment <id> [campo=valor]
  /delete investment <id>
  /add contribution "<nome>" <tipo> <valor>
  /list contributions "<nome>" <tipo>
  /edit contribution <id> [campo=valor]
  /delete contribution <id>

📊 Reports (Relatórios):
  /report
  /reportcsv
  /categories

🏋️ Habits (Hábitos):
  /add habit <nome> <frequência>
  /list habit
  /view habit <nome>
  /edit habit <id> [campo=valor]
  /delete habit <id>
  /link habit <nome|id> action <id|descrição>

🎯 OKRs (OKR, KPI, Actions):
  /add okr "<título>"
  /add kr <okr_id|okr_título> <título> [meta]
  /add action <kr_id|kr_título> <descrição>
  /list okr
  /view <título>
  /edit okr <id> [campo=valor]
  /edit kr <id> [campo=valor]
  /edit action <id> [campo=valor]
  /delete okr <id>
  /delete kr <id>
  /delete action <id>

🤖 AI:
  /ai okr "<título>" [descrição]

🔗 Outros:
  /start
  /refer
  /language <pt|en>
  /help
    ` : `
📚 Diindiin Bot Commands:

💰 Income:
  /add income <description> <amount>
  /list income
  /view <description>
  /edit income <id> [field=value]
  /delete income <id>

💸 Outcome (Expenses):
  /add <description> <amount>
  /add outcome <description> <amount>
  /list outcome
  /view <description>
  /edit expense <id> [field=value]
  /delete expense <id>

📈 Investments:
  /add investment "<name>" <type> <amount>
  /list investments
  /view <name>
  /edit investment <id> [field=value]
  /delete investment <id>
  /add contribution "<name>" <type> <amount>
  /list contributions "<name>" <type>
  /edit contribution <id> [field=value]
  /delete contribution <id>

📊 Reports:
  /report
  /reportcsv
  /categories

🏋️ Habits:
  /add habit <name> <frequency>
  /list habit
  /view habit <name>
  /edit habit <id> [field=value]
  /delete habit <id>
  /link habit <name|id> action <id|description>

🎯 OKRs (OKR, KPI, Actions):
  /add okr "<title>"
  /add kr <okr_id|okr_title> <title> [target]
  /add action <kr_id|kr_title> <description>
  /list okr
  /view <title>
  /edit okr <id> [field=value]
  /edit kr <id> [field=value]
  /edit action <id> [field=value]
  /delete okr <id>
  /delete kr <id>
  /delete action <id>

🤖 AI:
  /ai okr "<title>" [description]

🔗 Other:
  /start
  /refer
  /language <pt|en>
  /help
  `;

  await ctx.reply(helpMessage);
}


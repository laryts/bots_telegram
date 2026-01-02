import { Context } from 'telegraf';
import { createUser, getUserByTelegramId, getUserByReferralCode } from '../models/User';

export async function handleStart(ctx: Context, referralCode?: string) {
  try {
    const telegramId = ctx.from!.id.toString();
    const existingUser = await getUserByTelegramId(telegramId);

    if (existingUser) {
      return ctx.reply(
        `Welcome back, ${ctx.from!.first_name || 'User'}! 👋\n\n` +
        `Your referral code: ${existingUser.referral_code}\n\n` +
        `Use /help to see available commands.`
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
      referredBy
    );

    let welcomeMessage = `Welcome to Diindiin! 👋\n\n`;
    welcomeMessage += `I'll help you manage your finances.\n\n`;
    welcomeMessage += `Your referral code: ${user.referral_code}\n\n`;
    
    if (referredBy) {
      welcomeMessage += `You were referred by a friend! 🎉\n\n`;
    }
    
    welcomeMessage += `Available commands:\n`;
    welcomeMessage += `/add - Add an expense\n`;
    welcomeMessage += `/report - Monthly report\n`;
    welcomeMessage += `/habits - Manage habits\n`;
    welcomeMessage += `/okrs - Manage OKRs\n`;
    welcomeMessage += `/spreadsheet - Generate spreadsheet\n`;
    welcomeMessage += `/help - Show all commands`;

    await ctx.reply(welcomeMessage);
  } catch (error) {
    console.error('Error in start handler:', error);
    await ctx.reply('❌ Error starting bot. Please try again.');
  }
}

export async function handleRefer(ctx: Context) {
  try {
    const user = await getUserByTelegramId(ctx.from!.id.toString());
    
    if (!user) {
      return ctx.reply('Please start the bot first with /start');
    }

    const botUsername = ctx.botInfo?.username || 'your_bot';
    const referralLink = `https://t.me/${botUsername}?start=${user.referral_code}`;

    await ctx.reply(
      `🔗 Your Referral Link:\n\n${referralLink}\n\n` +
      `Share this link with friends to invite them!`
    );
  } catch (error) {
    console.error('Error getting referral:', error);
    await ctx.reply('❌ Error getting referral link. Please try again.');
  }
}

export async function handleHelp(ctx: Context) {
  const helpMessage = `
📚 Diindiin Bot Commands:

💰 Expenses:
  /add <amount> <description> - Add an expense
  Example: /add 50.00 Coffee at Starbucks
  Example: /add 50,00 Coffee (supports comma)

💰 Income:
  /income <amount> <description> - Add income
  Example: /income 5000.00 Salary
  /incomes - List incomes for current month

📊 Reports:
  /report - View monthly report (income, expenses, balance)
  /categories - View expenses by category

📈 Investments:
  /investments - List all investments
  /addinvestment <name> <type> <amount> <date> - Add investment
  /updateinvestment <id> <value> - Update investment value

🎯 OKRs:
  /okrs - List all OKRs
  /addobjective <title> - Add objective
  /addkr <objective_id> <title> [target] - Add key result
  /addaction <kr_id> <description> - Add action
  /updateprogress <action_id> <progress> - Update progress
  /okr <objective_id> - View specific OKR

🏋️ Habits:
  /habits - List all habits
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

❓ Help:
  /help - Show this help message
  `;

  await ctx.reply(helpMessage);
}


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
    welcomeMessage += `/categories - Expenses by category\n`;
    welcomeMessage += `/investments - Manage investments\n`;
    welcomeMessage += `/refer - Get your referral link\n`;
    welcomeMessage += `/help - Show this help message`;

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

📊 Reports:
  /report - View monthly expense report
  /categories - View expenses by category

📈 Investments:
  /investments - List all investments
  /addinvestment - Add a new investment
  /updateinvestment <id> <value> - Update investment value

🔗 Referrals:
  /refer - Get your referral link

❓ Help:
  /help - Show this help message
  `;

  await ctx.reply(helpMessage);
}


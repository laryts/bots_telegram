import { Context } from 'telegraf';
import { getUserByTelegramId } from '../models/User';
import {
  findOrCreateInvestment,
  getInvestmentsWithContributions,
  updateInvestmentValueByNameAndType,
  getTotalInvestments,
  createInvestmentContribution,
  getContributionsByInvestment,
  getTotalContributedByInvestment,
} from '../models/Investment';
import { format } from 'date-fns';

export async function handleAddInvestment(
  ctx: Context,
  name: string,
  type: string,
  amount: number,
  purchaseDate: Date,
  currentValue?: number,
  notes?: string
) {
  try {
    const user = await getUserByTelegramId(ctx.from!.id.toString());
    
    if (!user) {
      return ctx.reply('Please start the bot first with /start');
    }

    // Find or create investment
    const investment = await findOrCreateInvestment(user.id, name, type, notes);
    
    // Add contribution
    await createInvestmentContribution(
      investment.id,
      amount,
      purchaseDate,
      notes,
      currentValue
    );

    const totalContributed = await getTotalContributedByInvestment(user.id, name, type);
    const contributions = await getContributionsByInvestment(user.id, name, type);

    let message = `✅ Contribution added!\n\n`;
    message += `📈 Investment: ${name} (${type})\n`;
    message += `💰 Contribution: R$ ${amount.toFixed(2)}\n`;
    message += `📅 Date: ${format(purchaseDate, 'dd/MM/yyyy')}\n`;
    message += `\n📊 Total invested: R$ ${totalContributed.toFixed(2)}\n`;
    message += `📝 Contributions: ${contributions.length}\n`;
    
    if (currentValue !== undefined) {
      message += `💵 Current value: R$ ${currentValue.toFixed(2)}\n`;
      const returnAmount = currentValue - totalContributed;
      const returnPercent = totalContributed > 0 
        ? ((returnAmount / totalContributed) * 100).toFixed(2)
        : '0.00';
      message += `📈 Return: R$ ${returnAmount.toFixed(2)} (${returnPercent}%)`;
    }

    await ctx.reply(message);
  } catch (error) {
    console.error('Error adding investment:', error);
    await ctx.reply('❌ Error adding investment. Please try again.');
  }
}

export async function handleListInvestments(ctx: Context) {
  try {
    const user = await getUserByTelegramId(ctx.from!.id.toString());
    
    if (!user) {
      return ctx.reply('Please start the bot first with /start');
    }

    const investments = await getInvestmentsWithContributions(user.id);
    const totals = await getTotalInvestments(user.id);

    if (investments.length === 0 || investments.every(inv => inv.contribution_count === 0)) {
      return ctx.reply('📈 No investments recorded yet.');
    }

    let message = `📈 Your Investments:\n\n`;
    
    for (const inv of investments) {
      if (inv.contribution_count === 0) continue;
      
      const totalInvested = inv.total_contributed;
      const returnValue = inv.current_value 
        ? ((inv.current_value - totalInvested) / totalInvested * 100).toFixed(2)
        : '0.00';
      const returnAmount = inv.current_value 
        ? (inv.current_value - totalInvested).toFixed(2)
        : '0.00';
      
      message += `  • ${inv.name} (${inv.type})\n`;
      message += `    Invested: R$ ${totalInvested.toFixed(2)}\n`;
      message += `    Contributions: ${inv.contribution_count}\n`;
      if (inv.current_value) {
        message += `    Current: R$ ${inv.current_value.toFixed(2)}\n`;
        message += `    Return: R$ ${returnAmount} (${returnValue}%)\n`;
      }
      message += `\n`;
    }

    message += `\n💰 Total Invested: R$ ${totals.total_invested.toFixed(2)}\n`;
    message += `📊 Total Value: R$ ${totals.total_value.toFixed(2)}\n`;
    
    const totalReturn = totals.total_value - totals.total_invested;
    const totalReturnPercent = totals.total_invested > 0 
      ? ((totalReturn / totals.total_invested) * 100).toFixed(2)
      : '0.00';
    
    message += `📈 Total Return: R$ ${totalReturn.toFixed(2)} (${totalReturnPercent}%)`;

    await ctx.reply(message);
  } catch (error) {
    console.error('Error listing investments:', error);
    await ctx.reply('❌ Error listing investments. Please try again.');
  }
}

export async function handleUpdateInvestmentValue(
  ctx: Context,
  name: string,
  type: string,
  currentValue: number
) {
  try {
    const user = await getUserByTelegramId(ctx.from!.id.toString());
    
    if (!user) {
      return ctx.reply('Please start the bot first with /start');
    }

    const investment = await updateInvestmentValueByNameAndType(user.id, name, type, currentValue);
    
    if (!investment) {
      return ctx.reply('❌ Investment not found. Use /addinvestment to create it first.');
    }

    const totalInvested = await getTotalContributedByInvestment(user.id, name, type);
    const returnValue = totalInvested > 0
      ? ((currentValue - totalInvested) / totalInvested * 100).toFixed(2)
      : '0.00';
    const returnAmount = (currentValue - totalInvested).toFixed(2);

    await ctx.reply(
      `✅ Investment updated!\n\n` +
      `📈 ${investment.name} (${investment.type})\n` +
      `💰 Total Invested: R$ ${totalInvested.toFixed(2)}\n` +
      `💵 Current Value: R$ ${currentValue.toFixed(2)}\n` +
      `📊 Return: R$ ${returnAmount} (${returnValue}%)`
    );
  } catch (error) {
    console.error('Error updating investment:', error);
    await ctx.reply('❌ Error updating investment. Please try again.');
  }
}

export async function handleListContributions(ctx: Context, name: string, type: string) {
  try {
    const user = await getUserByTelegramId(ctx.from!.id.toString());
    
    if (!user) {
      return ctx.reply('Please start the bot first with /start');
    }

    const contributions = await getContributionsByInvestment(user.id, name, type);
    const totalInvested = await getTotalContributedByInvestment(user.id, name, type);

    if (contributions.length === 0) {
      return ctx.reply(`❌ No contributions found for "${name}" (${type}).`);
    }

    let message = `📝 Contributions for ${name} (${type}):\n\n`;
    
    for (const contrib of contributions) {
      message += `  • R$ ${contrib.amount.toFixed(2)} - ${format(new Date(contrib.contribution_date), 'dd/MM/yyyy')}\n`;
    }

    message += `\n💰 Total Invested: R$ ${totalInvested.toFixed(2)}\n`;
    message += `📊 Contributions: ${contributions.length}`;

    await ctx.reply(message);
  } catch (error) {
    console.error('Error listing contributions:', error);
    await ctx.reply('❌ Error listing contributions. Please try again.');
  }
}


import { Context } from 'telegraf';
import { getUserByTelegramId } from '../models/User';
import {
  createInvestment,
  getInvestmentsByUser,
  updateInvestmentValue,
  deleteInvestment,
  getTotalInvestments,
  getInvestmentById,
} from '../models/Investment';
import { format } from 'date-fns';

export async function handleAddInvestment(
  ctx: Context,
  name: string,
  type: string,
  amount: number,
  purchaseDate: Date,
  notes?: string
) {
  try {
    const user = await getUserByTelegramId(ctx.from!.id.toString());
    
    if (!user) {
      return ctx.reply('Please start the bot first with /start');
    }

    const investment = await createInvestment(user.id, name, type, amount, purchaseDate, notes);

    await ctx.reply(
      `✅ Investment added!\n\n` +
      `📈 Name: ${name}\n` +
      `🏷️ Type: ${type}\n` +
      `💰 Amount: R$ ${amount.toFixed(2)}\n` +
      `📅 Purchase Date: ${format(purchaseDate, 'dd/MM/yyyy')}\n` +
      (notes ? `📝 Notes: ${notes}` : '')
    );
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

    const investments = await getInvestmentsByUser(user.id);
    const totals = await getTotalInvestments(user.id);

    if (investments.length === 0) {
      return ctx.reply('📈 No investments recorded yet.');
    }

    let message = `📈 Your Investments:\n\n`;
    
    for (const inv of investments) {
      const returnValue = inv.current_value 
        ? ((inv.current_value - inv.amount) / inv.amount * 100).toFixed(2)
        : '0.00';
      const returnAmount = inv.current_value 
        ? (inv.current_value - inv.amount).toFixed(2)
        : '0.00';
      
      message += `  • ${inv.name} (${inv.type})\n`;
      message += `    Invested: R$ ${inv.amount.toFixed(2)}\n`;
      if (inv.current_value) {
        message += `    Current: R$ ${inv.current_value.toFixed(2)}\n`;
        message += `    Return: R$ ${returnAmount} (${returnValue}%)\n`;
      }
      message += `    Date: ${format(new Date(inv.purchase_date), 'dd/MM/yyyy')}\n\n`;
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

export async function handleUpdateInvestmentValue(ctx: Context, investmentId: number, currentValue: number) {
  try {
    const user = await getUserByTelegramId(ctx.from!.id.toString());
    
    if (!user) {
      return ctx.reply('Please start the bot first with /start');
    }

    // Check if investment exists and belongs to user
    const existingInvestment = await getInvestmentById(investmentId, user.id);
    if (!existingInvestment) {
      return ctx.reply('❌ Investment not found or you do not have permission.');
    }

    const investment = await updateInvestmentValue(investmentId, currentValue);

    const returnValue = ((currentValue - investment.amount) / investment.amount * 100).toFixed(2);
    const returnAmount = (currentValue - investment.amount).toFixed(2);

    await ctx.reply(
      `✅ Investment updated!\n\n` +
      `📈 ${investment.name}\n` +
      `💰 Current Value: R$ ${currentValue.toFixed(2)}\n` +
      `📊 Return: R$ ${returnAmount} (${returnValue}%)`
    );
  } catch (error) {
    console.error('Error updating investment:', error);
    await ctx.reply('❌ Error updating investment. Please try again.');
  }
}


import { Context } from 'telegraf';
import { getUserByTelegramId } from '../models/User';
import {
  createHabit,
  getHabitsByUser,
  findHabitByName,
  logHabit,
  getHabitStats,
  getAllHabitsYearlyReview,
  getHabitsByAction,
} from '../models/Habit';
import { format } from 'date-fns';

export async function handleAddHabit(ctx: Context, name: string, frequency: string) {
  try {
    const user = await getUserByTelegramId(ctx.from!.id.toString());
    
    if (!user) {
      return ctx.reply('Please start the bot first with /start');
    }

    // Parse frequency
    let frequencyType = 'daily';
    let frequencyValue: number | undefined;

    if (frequency.toLowerCase().includes('diário') || frequency.toLowerCase().includes('daily')) {
      frequencyType = 'daily';
    } else if (frequency.toLowerCase().includes('semana') || frequency.toLowerCase().includes('week')) {
      frequencyType = 'weekly';
      // Extract number from frequency (e.g., "4x por semana" -> 4)
      const match = frequency.match(/(\d+)/);
      if (match) {
        frequencyValue = parseInt(match[1]);
      }
    }

    const habit = await createHabit(user.id, name, frequencyType, frequencyValue);

    await ctx.reply(
      `✅ Habit added!\n\n` +
      `🏋️ ${habit.name}\n` +
      `📅 Frequency: ${frequencyType === 'daily' ? 'Daily' : `${frequencyValue || 'N/A'}x per week`}`
    );
  } catch (error) {
    console.error('Error adding habit:', error);
    await ctx.reply('❌ Error adding habit. Please try again.');
  }
}

export async function handleLogHabit(ctx: Context, name: string, value?: string, dateStr?: string) {
  try {
    const user = await getUserByTelegramId(ctx.from!.id.toString());
    
    if (!user) {
      return ctx.reply('Please start the bot first with /start');
    }

    const habit = await findHabitByName(user.id, name);
    if (!habit) {
      return ctx.reply(`❌ Habit "${name}" not found. Create it first with /addhabit`);
    }

    // Parse date
    let date = new Date();
    if (dateStr) {
      const parsedDate = new Date(dateStr);
      if (!isNaN(parsedDate.getTime())) {
        date = parsedDate;
      }
    }

    // Parse value if provided
    let numericValue: number | undefined;
    if (value) {
      // Try to extract number from value (e.g., "2L" -> 2, "2.5" -> 2.5)
      const valueMatch = value.match(/(\d+\.?\d*)/);
      if (valueMatch) {
        numericValue = parseFloat(valueMatch[1]);
      }
    }

    await logHabit(habit.id, date, numericValue);

    let message = `✅ Habit logged!\n\n`;
    message += `🏋️ ${habit.name}\n`;
    message += `📅 Date: ${format(date, 'dd/MM/yyyy')}\n`;
    if (numericValue !== undefined) {
      message += `📊 Value: ${numericValue}${habit.unit || ''}\n`;
    }
    message += `\nCounted as 1 day!`;

    await ctx.reply(message);
  } catch (error) {
    console.error('Error logging habit:', error);
    await ctx.reply('❌ Error logging habit. Please try again.');
  }
}

export async function handleListHabits(ctx: Context) {
  try {
    const user = await getUserByTelegramId(ctx.from!.id.toString());
    
    if (!user) {
      return ctx.reply('Please start the bot first with /start');
    }

    const habits = await getHabitsByUser(user.id);

    if (habits.length === 0) {
      return ctx.reply('📊 No habits found. Create one with /addhabit');
    }

    const currentYear = new Date().getFullYear();
    let message = `📊 Your Habits:\n\n`;

    for (const habit of habits) {
      const stats = await getHabitStats(habit.id, currentYear);
      message += `🏋️ ${habit.name}\n`;
      message += `   📅 ${stats.completedDays} days this year (${stats.percentage.toFixed(1)}%)\n`;
      if (stats.streak > 0) {
        message += `   🔥 Streak: ${stats.streak} days\n`;
      }
      message += `\n`;
    }

    await ctx.reply(message);
  } catch (error) {
    console.error('Error listing habits:', error);
    await ctx.reply('❌ Error listing habits. Please try again.');
  }
}

export async function handleHabitReview(ctx: Context) {
  try {
    const user = await getUserByTelegramId(ctx.from!.id.toString());
    
    if (!user) {
      return ctx.reply('Please start the bot first with /start');
    }

    const currentYear = new Date().getFullYear();
    const review = await getAllHabitsYearlyReview(user.id, currentYear);

    if (review.length === 0) {
      return ctx.reply('📊 No habits found. Create one with /addhabit');
    }

    // Emoji mapping for common habits
    const emojiMap: { [key: string]: string } = {
      'treino': '🏋️',
      'treinar': '🏋️',
      'ler': '📚',
      'leitura': '📚',
      'agua': '💧',
      'água': '💧',
      'sono': '😴',
      'sleep': '😴',
    };

    const getEmoji = (name: string): string => {
      const lowerName = name.toLowerCase();
      for (const [key, emoji] of Object.entries(emojiMap)) {
        if (lowerName.includes(key)) {
          return emoji;
        }
      }
      return '✅';
    };

    let message = `📊 Habit Review ${currentYear}:\n\n`;

    for (const { habit, count } of review) {
      const emoji = getEmoji(habit.name);
      message += `${emoji} ${habit.name}: ${count} days\n`;
    }

    await ctx.reply(message);
  } catch (error) {
    console.error('Error generating habit review:', error);
    await ctx.reply('❌ Error generating habit review. Please try again.');
  }
}

export async function handleHabitStats(ctx: Context, name: string) {
  try {
    const user = await getUserByTelegramId(ctx.from!.id.toString());
    
    if (!user) {
      return ctx.reply('Please start the bot first with /start');
    }

    const habit = await findHabitByName(user.id, name);
    if (!habit) {
      return ctx.reply(`❌ Habit "${name}" not found.`);
    }

    const currentYear = new Date().getFullYear();
    const stats = await getHabitStats(habit.id, currentYear);

    let message = `📊 ${habit.name} - Statistics\n\n`;
    message += `📅 Year: ${currentYear}\n`;
    message += `✅ Completed: ${stats.completedDays} days\n`;
    message += `📈 Total Days: ${stats.totalDays}\n`;
    message += `📊 Percentage: ${stats.percentage.toFixed(1)}%\n`;
    if (stats.streak > 0) {
      message += `🔥 Current Streak: ${stats.streak} days\n`;
    }

    await ctx.reply(message);
  } catch (error) {
    console.error('Error getting habit stats:', error);
    await ctx.reply('❌ Error getting habit stats. Please try again.');
  }
}

export async function handleHabitProgress(ctx: Context) {
  try {
    const user = await getUserByTelegramId(ctx.from!.id.toString());
    
    if (!user) {
      return ctx.reply('Please start the bot first with /start');
    }

    const habits = await getHabitsByUser(user.id);
    const currentYear = new Date().getFullYear();

    if (habits.length === 0) {
      return ctx.reply('📊 No habits found. Create one with /addhabit');
    }

    let message = `📊 Habit Progress ${currentYear}:\n\n`;

    for (const habit of habits) {
      const stats = await getHabitStats(habit.id, currentYear);
      message += `🏋️ ${habit.name}\n`;
      message += `   ${stats.completedDays}/${stats.totalDays} days (${stats.percentage.toFixed(1)}%)\n`;
      if (stats.streak > 0) {
        message += `   🔥 Streak: ${stats.streak} days\n`;
      }
      message += `\n`;
    }

    await ctx.reply(message);
  } catch (error) {
    console.error('Error getting habit progress:', error);
    await ctx.reply('❌ Error getting habit progress. Please try again.');
  }
}

export async function handleLinkHabitToAction(ctx: Context, habitName: string, actionId: number) {
  try {
    const user = await getUserByTelegramId(ctx.from!.id.toString());
    
    if (!user) {
      return ctx.reply('Please start the bot first with /start');
    }

    const habit = await findHabitByName(user.id, habitName);
    if (!habit) {
      return ctx.reply(`❌ Habit "${habitName}" not found.`);
    }

    // Note: This would require updating the habit model to support linking
    // For now, we'll just acknowledge the request
    await ctx.reply(
      `✅ Habit linked to action!\n\n` +
      `🏋️ ${habit.name}\n` +
      `📝 Action ID: ${actionId}\n\n` +
      `Note: Full linking functionality will be available in future updates.`
    );
  } catch (error) {
    console.error('Error linking habit:', error);
    await ctx.reply('❌ Error linking habit. Please try again.');
  }
}


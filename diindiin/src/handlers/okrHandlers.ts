import { Context } from 'telegraf';
import { getUserByTelegramId } from '../models/User';
import {
  createObjective,
  getObjectivesByUser,
  getObjectiveById,
  createKeyResult,
  getKeyResultsByObjective,
  createAction,
  getActionsByKeyResult,
  updateAction,
} from '../models/OKR';

export async function handleAddObjective(ctx: Context, title: string) {
  try {
    const user = await getUserByTelegramId(ctx.from!.id.toString());
    
    if (!user) {
      return ctx.reply('Please start the bot first with /start');
    }

    const objective = await createObjective(user.id, title);

    await ctx.reply(
      `✅ Objective added!\n\n` +
      `🎯 ${objective.title}\n` +
      `ID: ${objective.id}`
    );
  } catch (error) {
    console.error('Error adding objective:', error);
    await ctx.reply('❌ Error adding objective. Please try again.');
  }
}

export async function handleAddKeyResult(ctx: Context, objectiveId: number, title: string, target?: string) {
  try {
    const user = await getUserByTelegramId(ctx.from!.id.toString());
    
    if (!user) {
      return ctx.reply('Please start the bot first with /start');
    }

    const objective = await getObjectiveById(objectiveId, user.id);
    if (!objective) {
      return ctx.reply('❌ Objective not found or you do not have permission.');
    }

    const targetValue = target ? parseFloat(target) : undefined;
    const keyResult = await createKeyResult(objectiveId, title, targetValue);

    await ctx.reply(
      `✅ Key Result added!\n\n` +
      `📊 ${keyResult.title}\n` +
      (targetValue ? `Target: ${targetValue}\n` : '') +
      `ID: ${keyResult.id}`
    );
  } catch (error) {
    console.error('Error adding key result:', error);
    await ctx.reply('❌ Error adding key result. Please try again.');
  }
}

export async function handleAddAction(ctx: Context, keyResultId: number, description: string) {
  try {
    const user = await getUserByTelegramId(ctx.from!.id.toString());
    
    if (!user) {
      return ctx.reply('Please start the bot first with /start');
    }

    // Verify key result belongs to user
    const keyResults = await getKeyResultsByObjective(keyResultId);
    if (keyResults.length === 0) {
      return ctx.reply('❌ Key Result not found.');
    }

    const action = await createAction(keyResultId, description);

    await ctx.reply(
      `✅ Action added!\n\n` +
      `📝 ${action.description}\n` +
      `ID: ${action.id}`
    );
  } catch (error) {
    console.error('Error adding action:', error);
    await ctx.reply('❌ Error adding action. Please try again.');
  }
}

export async function handleUpdateProgress(ctx: Context, actionId: number, progress: string) {
  try {
    const user = await getUserByTelegramId(ctx.from!.id.toString());
    
    if (!user) {
      return ctx.reply('Please start the bot first with /start');
    }

    const action = await updateAction(actionId, undefined, undefined, progress);

    if (!action) {
      return ctx.reply('❌ Action not found.');
    }

    await ctx.reply(
      `✅ Progress updated!\n\n` +
      `📝 ${action.description}\n` +
      `📊 Progress: ${progress}`
    );
  } catch (error) {
    console.error('Error updating progress:', error);
    await ctx.reply('❌ Error updating progress. Please try again.');
  }
}

export async function handleListOKRs(ctx: Context) {
  try {
    const user = await getUserByTelegramId(ctx.from!.id.toString());
    
    if (!user) {
      return ctx.reply('Please start the bot first with /start');
    }

    const objectives = await getObjectivesByUser(user.id);

    if (objectives.length === 0) {
      return ctx.reply('📊 No OKRs found. Create one with /addobjective');
    }

    let message = `📊 Your OKRs:\n\n`;

    for (const objective of objectives) {
      message += `🎯 ${objective.title} (ID: ${objective.id})\n`;
      
      const keyResults = await getKeyResultsByObjective(objective.id);
      for (const kr of keyResults) {
        message += `  📊 ${kr.title}`;
        if (kr.target_value) {
          message += ` - Target: ${kr.target_value}`;
          if (kr.current_value) {
            message += ` / Current: ${kr.current_value}`;
          }
        }
        message += `\n`;

        const actions = await getActionsByKeyResult(kr.id);
        for (const action of actions) {
          message += `    📝 ${action.description}`;
          if (action.progress) {
            message += ` (${action.progress})`;
          }
          message += `\n`;
        }
      }
      message += `\n`;
    }

    await ctx.reply(message);
  } catch (error) {
    console.error('Error listing OKRs:', error);
    await ctx.reply('❌ Error listing OKRs. Please try again.');
  }
}

export async function handleViewOKR(ctx: Context, objectiveId: number) {
  try {
    const user = await getUserByTelegramId(ctx.from!.id.toString());
    
    if (!user) {
      return ctx.reply('Please start the bot first with /start');
    }

    const objective = await getObjectiveById(objectiveId, user.id);
    if (!objective) {
      return ctx.reply('❌ Objective not found or you do not have permission.');
    }

    let message = `🎯 ${objective.title}\n`;
    if (objective.description) {
      message += `${objective.description}\n`;
    }
    if (objective.target_date) {
      message += `📅 Target Date: ${new Date(objective.target_date).toLocaleDateString()}\n`;
    }
    message += `\n`;

    const keyResults = await getKeyResultsByObjective(objective.id);
    for (const kr of keyResults) {
      message += `📊 ${kr.title}\n`;
      if (kr.target_value) {
        message += `   Target: ${kr.target_value}`;
        if (kr.current_value) {
          message += ` / Current: ${kr.current_value}`;
        }
        message += `\n`;
      }

      const actions = await getActionsByKeyResult(kr.id);
      for (const action of actions) {
        message += `   📝 ${action.description}`;
        if (action.progress) {
          message += ` - ${action.progress}`;
        }
        message += `\n`;
      }
      message += `\n`;
    }

    await ctx.reply(message);
  } catch (error) {
    console.error('Error viewing OKR:', error);
    await ctx.reply('❌ Error viewing OKR. Please try again.');
  }
}


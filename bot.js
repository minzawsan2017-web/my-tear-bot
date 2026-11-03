require('dotenv').config();
const { Bot, InlineKeyboard, Keyboard, HttpError } = require('grammy'); // 👈 ဒီနေရာမှာ HttpError ကို ထည့်သွင်းပေးပါ
const mongoose = require('mongoose');
const express = require('express');
const { User, Setting } = require('./models');

const bot = new Bot(process.env.BOT_TOKEN);
const OWNER_ID = Number(process.env.OWNER_ID);

// 📌 Bot Error Handling
bot.catch((err) => {
    const ctx = err.ctx;
    console.error(`Error while handling update ${ctx.update.update_id}:`);
    const e = err.error;
    if (e instanceof HttpError) {
        console.error("Could not contact Telegram:", e);
    } else {
        console.error("Unknown error:", e);
    }
});

// ကျန်တဲ့ Code တွေကတော့ အရင်အတိုင်း ဆက်ရှိနေပါမယ်...

// MongoDB ချိတ်ဆက်ခြင်း
mongoose.connect(process.env.MONGO_URI).then(() => {
    console.log('Connected to MongoDB successfully!');
});

// Express Server (UptimeRobot Keep-Alive)
const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('HeartMatch CUPID Bot is running alive! 💖'));
app.listen(PORT, () => console.log(`Server is listening on port ${PORT}`));

// အကွာအဝေး (KM) တွက်ချက်ခြင်း
function calculateDistance(lat1, lon1, lat2, lon2) {
    if (!lat1 || !lon1 || !lat2 || !lon2) return "မသိရှိရပါ";
    const R = 6371;
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * 
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return (R * c).toFixed(2);
}

// Group/Channel Join စစ်ဆေးသည့် Helper
async function checkUserSubscription(ctx, userId) {
    try {
        const groupSetting = await Setting.findOne({ key: 'group_link' });
        const channelSetting = await Setting.findOne({ key: 'channel_link' });

        let isGroupJoined = true;
        let isChannelJoined = true;

        if (groupSetting && groupSetting.chatId) {
            const gMember = await ctx.api.getChatMember(groupSetting.chatId, userId);
            isGroupJoined = ['creator', 'administrator', 'member'].includes(gMember.status);
        }
        if (channelSetting && channelSetting.chatId) {
            const cMember = await ctx.api.getChatMember(channelSetting.chatId, userId);
            isChannelJoined = ['creator', 'administrator', 'member'].includes(cMember.status);
        }

        return isGroupJoined && isChannelJoined;
    } catch (err) {
        return false;
    }
}

// ပင်မ Reply Keyboard
const mainReplyKeyboard = new Keyboard()
    .requestLocation('📍 တည်နေရာပေးပို့မည်').row()
    .text('💘 ရည်းစားရှာမယ်').text('🤝 Just Friend ရှာမယ်').row()
    .text('🎮 ဂိမ်းဆော့ဖော်ရှာမယ်').text('💬 Chat').row()
    .text('💌 ငါ့ကိုသဘောကျသူများ').text('👤 မိမိ Profile')
    .resized()
    .persistent();


// ==========================================
// 1. OWNER COMMANDS
// ==========================================

bot.command('HeartMatchstartinfo', async (ctx) => {
    if (ctx.chat.type !== 'private' || ctx.from.id !== OWNER_ID) return;
    const replyMsg = ctx.message.reply_to_message;
    if (!replyMsg || (!replyMsg.photo && !replyMsg.video)) return ctx.reply('❌ ပုံ သို့မဟုတ် ဗီဒီယိုကို Reply ထောက်ပါ။');
    let fileId = replyMsg.photo ? replyMsg.photo[replyMsg.photo.length - 1].file_id : replyMsg.video.file_id;
    let mediaType = replyMsg.photo ? 'photo' : 'video';

    await Setting.findOneAndUpdate({ key: 'start_media' }, { key: 'start_media', type: mediaType, fileId: fileId }, { upsert: true });
    return ctx.reply('✅ Start Media သိမ်းဆည်းပြီးပါပြီ။');
});

bot.command('Delstartheart', async (ctx) => {
    if (ctx.chat.type !== 'private' || ctx.from.id !== OWNER_ID) return;
    await Setting.deleteOne({ key: 'start_media' });
    return ctx.reply('🗑 Start Media ကို ဖျက်ပြီးပါပြီ။');
});

bot.command('startlinkGroup', async (ctx) => {
    if (ctx.chat.type !== 'private' || ctx.from.id !== OWNER_ID) return;
    const args = ctx.match.trim().split(' ');
    await Setting.findOneAndUpdate({ key: 'group_link' }, { key: 'group_link', type: 'link', link: args[0], chatId: args[1] ? Number(args[1]) : null }, { upsert: true });
    return ctx.reply('✅ Group Link သတ်မှတ်ပြီးပါပြီ။');
});

bot.command('startgpdel', async (ctx) => {
    if (ctx.chat.type !== 'private' || ctx.from.id !== OWNER_ID) return;
    await Setting.deleteOne({ key: 'group_link' });
    return ctx.reply('🗑 Group Link ဖျက်ပြီးပါပြီ။');
});

bot.command('startlinkChannel', async (ctx) => {
    if (ctx.chat.type !== 'private' || ctx.from.id !== OWNER_ID) return;
    const args = ctx.match.trim().split(' ');
    await Setting.findOneAndUpdate({ key: 'channel_link' }, { key: 'channel_link', type: 'link', link: args[0], chatId: args[1] ? Number(args[1]) : null }, { upsert: true });
    return ctx.reply('✅ Channel Link သတ်မှတ်ပြီးပါပြီ။');
});

bot.command('startchdel', async (ctx) => {
    if (ctx.chat.type !== 'private' || ctx.from.id !== OWNER_ID) return;
    await Setting.deleteOne({ key: 'channel_link' });
    return ctx.reply('🗑 Channel Link ဖျက်ပြီးပါပြီ။');
});

bot.command('setMatchGroup', async (ctx) => {
    if (ctx.chat.type !== 'private' || ctx.from.id !== OWNER_ID) return;
    await Setting.findOneAndUpdate({ key: 'match_group_link' }, { key: 'match_group_link', type: 'link', link: ctx.match }, { upsert: true });
    return ctx.reply('✅ Match Group Link သတ်မှတ်ပြီးပါပြီ။');
});


// ==========================================
// 2. START & REGISTRATION
// ==========================================

bot.command('start', async (ctx) => {
    if (ctx.chat.type !== 'private') return;

    const userId = ctx.from.id;
    const userFirstName = ctx.from.first_name || 'သူ';
    const username = ctx.from.username ? `@${ctx.from.username}` : `nofount <a href="https://t.me/Tear808">(@Tear808)</a>`;
    const userBio = ctx.from.bio || '';

    let dbUser = await User.findOne({ telegramId: userId });

    if (dbUser && dbUser.step === 'COMPLETED') {
        const isJoined = await checkUserSubscription(ctx, userId);
        if (!isJoined) return ctx.reply(`❌ ကျေးဇူးပြု၍ Group နှင့် Channel ကို အရင် Join ပေးပါရှင့်။`);
        return ctx.reply(`✨ မင်္ဂလာပါ ${dbUser.name}၊ ပြန်လည်ကြိုဆိုပါတယ်!`, { reply_markup: mainReplyKeyboard });
    }

    await User.findOneAndUpdate({ telegramId: userId }, { step: 'IDLE' }, { upsert: true });

    const startMedia = await Setting.findOne({ key: 'start_media' });
    const loveLink = "https://t.me/HeartMatch_CUPID_Bot"; 
    const captionText = 
`📮မဂ်လာပါℋℯ𝒶𝓇𝓉ℳ𝒶𝓉𝒸𝒽--ᴄᴜපිᴅ💗မှ
     ကြိုဆိုပါတယ် (<a href="${loveLink}">LOVE</a>)
:-----------------------------------------------------:
Name👤:- ${userFirstName}
ID🆔       :- ${userId}
@user.   :- ${username}
${userBio ? `Bio💌    :- ${userBio}` : ''}`;

    const groupSetting = await Setting.findOne({ key: 'group_link' });
    const channelSetting = await Setting.findOne({ key: 'channel_link' });

    const inlineKeyboard = new InlineKeyboard()
        .url('Group join📩', groupSetting ? groupSetting.link : 'https://t.me/Tear808').row()
        .url('Channel join💌', channelSetting ? channelSetting.link : 'https://t.me/Tear808').row()
        .text('Check Join ⏳', 'check_join');

    if (startMedia) {
        if (startMedia.type === 'photo') await ctx.replyWithPhoto(startMedia.fileId, { caption: captionText, parse_mode: 'HTML', reply_markup: inlineKeyboard });
        else await ctx.replyWithVideo(startMedia.fileId, { caption: captionText, parse_mode: 'HTML', reply_markup: inlineKeyboard });
    } else {
        await ctx.reply(captionText, { parse_mode: 'HTML', reply_markup: inlineKeyboard });
    }
});

bot.callbackQuery('check_join', async (ctx) => {
    const userId = ctx.from.id;
    const isJoined = await checkUserSubscription(ctx, userId);

    if (!isJoined) {
        await ctx.answerCallbackQuery({ text: "❌ ကျေးဇူးပြု၍ Group နှင့် Channel ကို အရင် Join ပေးပါရှင့်!", show_alert: true });
        return;
    }

    await ctx.answerCallbackQuery();
    await User.findOneAndUpdate({ telegramId: userId }, { step: 'REG_NAME' });
    await ctx.reply(`⏳အမည်အရင်း(သို့)ကြိုနှစ်သက်ရာအမည်\n       ရေးပီးပို့ပေးပါရှင့် နှိပ်ရန် နှိပ်ပါ 🗒 \n----ℋℯ𝒶𝓇𝓉ℳ𝒶𝓉𝒸𝒽-----`);
});


// ==========================================
// 3. CHAT FEATURE
// ==========================================

bot.hears('💬 Chat', async (ctx) => {
    if (ctx.chat.type !== 'private') return;
    const userId = ctx.from.id;

    const isJoined = await checkUserSubscription(ctx, userId);
    if (!isJoined) return ctx.reply(`⚠️ Group နှင့် Channel ကို အရင် Join ပေးပါရှင့်။`);

    const user = await User.findOne({ telegramId: userId });
    const combinedList = Array.from(new Set([...(user.myLikes || []), ...(user.likedBy || [])]));

    if (!user || combinedList.length === 0) {
        return ctx.reply(`📭 သင့်ထံတွင် စကားပြောရန် ချိတ်ဆက်ထားသော Profile မရှိသေးပါ။ Like ပေးခြင်း (သို့) ပေးခံရခြင်း ရှိမှ သုံးနိုင်ပါမည်။`, { reply_markup: mainReplyKeyboard });
    }

    await showMatchedUserForChat(ctx, userId, combinedList, 0);
});

async function showMatchedUserForChat(ctx, userId, list, index) {
    if (index >= list.length) {
        return ctx.reply(`🏁 ချိတ်ဆက်ထားသော စာရင်းကုန်ဆုံးသွားပါပြီ။`, { reply_markup: mainReplyKeyboard });
    }

    const targetId = list[index];
    const targetUser = await User.findOne({ telegramId: targetId });

    if (!targetUser) {
        return showMatchedUserForChat(ctx, userId, list, index + 1);
    }

    const caption = 
`💬 **Match Chat Profile**
------------------------------------
အမည် - ❤️ ${targetUser.name}
အသက် - ${targetUser.age} နှစ်
လိင် - ${targetUser.genderType}
မြို့နယ် - ${targetUser.locationText}
Bio - ${targetUser.bio}
------------------------------------`;

    const chatKeyboard = new InlineKeyboard()
        .text('✏️ Type.. (စာပို့ရန်)', `type_msg_${targetId}`).row()
        .text('⏭ Skip (နောက်တစ်ယောက်)', `skip_chat_${index + 1}`).row()
        .text('🏠 မူလမီနူးသို့ သွားရန်', 'action_main_menu');

    if (targetUser.photoFileId) {
        await ctx.replyWithPhoto(targetUser.photoFileId, { caption: caption, parse_mode: 'Markdown', reply_markup: chatKeyboard });
    } else {
        await ctx.reply(caption, { parse_mode: 'Markdown', reply_markup: chatKeyboard });
    }
}

bot.callbackQuery(/^skip_chat_(\d+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const userId = ctx.from.id;
    const user = await User.findOne({ telegramId: userId });
    const combinedList = Array.from(new Set([...(user.myLikes || []), ...(user.likedBy || [])]));
    const nextIndex = Number(ctx.match[1]);

    await showMatchedUserForChat(ctx, userId, combinedList, nextIndex);
});

bot.callbackQuery(/^type_msg_(\d+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const targetId = Number(ctx.match[1]);
    const userId = ctx.from.id;

    const sender = await User.findOne({ telegramId: userId });
    if (sender.blockedChats && sender.blockedChats.includes(targetId)) {
        return ctx.reply(`⚠️ သင့်အား ဤ Profile မှ ငြင်းပယ်ထားပါသည် (Block ထားပါသည်)။`);
    }

    await User.findOneAndUpdate({ telegramId: userId }, { step: 'SENDING_CHAT_MSG', chatTarget: targetId, msgCount: 0 });

    const stopKeyboard = new InlineKeyboard()
        .text('⛔ Dchat (စာဆက်မပို့တော့ပါ)', 'stop_chat_session').row()
        .text('🏠 မူလမီနူးသို့ သွားရန်', 'action_main_menu');

    await ctx.reply(
        `💌 စာစတင်ပို့နိုင်ပါပြီ။ (တစ်ဖက်လူမှ လက်မခံသေးမီ အများဆုံး စာ ၂ ကြောင်းသာ ပို့ခွင့်ရပါမည်)\n\n` +
        `🛑 **စာဆက်မပို့လိုပါက အောက်ပါ "⛔ Dchat" ခလုတ်ကို နှိပ်ပါ**\n\n` +
        `👇 ယခု စာစတင် ရေးသားပါ -`,
        { reply_markup: stopKeyboard }
    );
});

bot.callbackQuery('stop_chat_session', async (ctx) => {
    await ctx.answerCallbackQuery();
    const userId = ctx.from.id;
    await User.findOneAndUpdate({ telegramId: userId }, { step: 'COMPLETED', chatTarget: null });
    await ctx.reply(`🛑 စာပို့ခြင်းကို ရပ်တန့်လိုက်ပါပြီ။`, { reply_markup: mainReplyKeyboard });
});

bot.callbackQuery(/^accept_chat_(\d+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const senderId = Number(ctx.match[1]);
    const receiverId = ctx.from.id;

    await User.findOneAndUpdate({ telegramId: receiverId }, { $addToSet: { acceptedChats: senderId } });
    await User.findOneAndUpdate({ telegramId: senderId }, { $addToSet: { acceptedChats: receiverId } });

    await ctx.reply(`🥰 စကားပြောဆိုခြင်းကို လက်ခံလိုက်ပါပြီ!`);
    try {
        await ctx.api.sendMessage(senderId, `🎉 သတင်းကောင်းပါ! သင့်အား စကားပြောရန် လက်ခံလိုက်ပါပြီ 💖`);
    } catch(e) {}
});

bot.callbackQuery(/^decline_chat_(\d+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const senderId = Number(ctx.match[1]);
    const receiverId = ctx.from.id;

    await User.findOneAndUpdate({ telegramId: receiverId }, { $addToSet: { blockedChats: senderId } });
    await User.findOneAndUpdate({ telegramId: senderId }, { $addToSet: { blockedChats: receiverId } });

    await ctx.reply(`❌ စကားပြောဆိုခြင်းကို ငြင်းပယ်လိုက်ပါပြီ။`);
    try {
        await ctx.api.sendMessage(senderId, `⚠️ သင့်အား ဘလောက် (Block) ထားရှိပါသည်ခင်ဗျာ။`);
    } catch(e) {}
});


// ==========================================
// 4. SEARCH & SEARCH LIKE HANDLER
// ==========================================

async function searchAndShowCandidate(ctx, mode, excludeIds = []) {
    const userId = ctx.from.id;
    const isJoined = await checkUserSubscription(ctx, userId);
    if (!isJoined) return ctx.reply(`⚠️ Group နှင့် Channel ကို အရင် Join ပေးပါရှင့်။`);

    const currentUser = await User.findOne({ telegramId: userId });
    if (!currentUser || currentUser.step !== 'COMPLETED') return ctx.reply(`❌ /start ဖြင့် အချက်အလက် အရင် ဖြည့်ပါ။`);

    let targetGender = currentUser.genderType === 'Boy 🤴' ? 'Girl 👸' : 'Boy 🤴';
    const query = mode === 'dating' 
        ? { telegramId: { $ne: userId, $nin: excludeIds }, genderType: targetGender, step: 'COMPLETED' }
        : { telegramId: { $ne: userId, $nin: excludeIds }, step: 'COMPLETED' };

    const candidate = await User.findOne(query);
    if (!candidate) return ctx.reply(`😔 ထပ်မံပြသနိုင်သော Profile မရှိသေးပါ။`, { reply_markup: mainReplyKeyboard });

    const distanceStr = calculateDistance(currentUser.latitude, currentUser.longitude, candidate.latitude, candidate.longitude);
    const modeText = mode === 'dating' ? 'ဖူးစာရှင်' : mode === 'friend' ? 'Just Friend' : 'ဂိမ်းဆော့ဖော်';

    const likesArray = candidate.likesCount || [];
    const nextsArray = candidate.nextsCount || [];

    const candidateCaption = 
`👤 **Match Profile (${modeText})**
------------------------------------
အမည် - ❤️ ${candidate.name}
အသက် - ${candidate.age} နှစ်
လိင် - ${candidate.genderType}
မြို့နယ် - ${candidate.locationText}
Bio - ${candidate.bio}
🟡 အကွာအဝေး - ${distanceStr} km
------------------------------------`;

    const matchKeyboard = new InlineKeyboard()
        .text(`❤️ Like (${likesArray.length} people)`, `like_${candidate.telegramId}_${mode}`)
        .text(`❌ Next (${nextsArray.length} people)`, `next_${candidate.telegramId}_${mode}`);

    if (candidate.photoFileId) {
        await ctx.replyWithPhoto(candidate.photoFileId, { caption: candidateCaption, parse_mode: 'Markdown', reply_markup: matchKeyboard });
    } else {
        await ctx.reply(candidateCaption, { parse_mode: 'Markdown', reply_markup: matchKeyboard });
    }
}

bot.callbackQuery(/^like_(\d+)_(dating|friend|game)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const targetId = Number(ctx.match[1]);
    const senderId = ctx.from.id;

    await User.findOneAndUpdate({ telegramId: senderId }, { $addToSet: { myLikes: targetId } });
    await User.findOneAndUpdate({ telegramId: targetId }, { $addToSet: { likesCount: senderId, likedBy: senderId } });

    await ctx.reply(`⌛ အတည်ပြုပြီးပါပြီ။ သင်၏ Like စာရင်းထဲသို့ ထည့်ပြီးပါပြီ 💌`, { reply_markup: mainReplyKeyboard });
});

bot.callbackQuery(/^next_(\d+)_(dating|friend|game)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const currentCandidateId = Number(ctx.match[1]);
    const mode = ctx.match[2];
    await User.findOneAndUpdate({ telegramId: currentCandidateId }, { $addToSet: { nextsCount: ctx.from.id } });
    await searchAndShowCandidate(ctx, mode, [currentCandidateId]);
});

bot.hears('💘 ရည်းစားရှာမယ်', async (ctx) => { if (ctx.chat.type === 'private') await searchAndShowCandidate(ctx, 'dating'); });
bot.hears('🤝 Just Friend ရှာမယ်', async (ctx) => { if (ctx.chat.type === 'private') await searchAndShowCandidate(ctx, 'friend'); });
bot.hears('🎮 ဂိမ်းဆော့ဖော်ရှာမယ်', async (ctx) => { if (ctx.chat.type === 'private') await searchAndShowCandidate(ctx, 'game'); });


// ==========================================
// 5. PROFILE & EDIT
// ==========================================

bot.hears('👤 မိမိ Profile', async (ctx) => {
    if (ctx.chat.type !== 'private') return;
    const userId = ctx.from.id;
    const isJoined = await checkUserSubscription(ctx, userId);
    if (!isJoined) return ctx.reply(`⚠️ Group နှင့် Channel ကို အရင် Join ပေးပါရှင့်။`);

    const user = await User.findOne({ telegramId: userId });
    if (!user || user.step !== 'COMPLETED') return ctx.reply(`❌ မှတ်ပုံတင်ခြင်း မပြီးသေးပါ။`);

    const profileText = 
`👤 **သင့်၏ ကိုယ်ရေးအချက်အလက် (Profile)**
------------------------------------
📝 အမည် - ${user.name}
🌿 အသက် - ${user.age} နှစ်
🌷 လိင် - ${user.genderType}
🏡 မြို့နယ် - ${user.locationText}
🤍 Bio - ${user.bio}
------------------------------------`;

    const profileInlineKeyboard = new InlineKeyboard()
        .text('⚙️ ကိုယ်ရေးအချက်အလက် ပြင်ရန်/ကြည့်ရန်', 'action_edit_profile').row()
        .text('🗑 ကိုယ်အကြောင်းအချက်အလက် အကုန်ဖျက်ရန်', 'action_delete_profile').row()
        .text('🏠 မူလမီနူးသို့ သွားရန်', 'action_main_menu');

    if (user.photoFileId) {
        await ctx.replyWithPhoto(user.photoFileId, { caption: profileText, parse_mode: 'Markdown', reply_markup: profileInlineKeyboard });
    } else {
        await ctx.reply(profileText, { parse_mode: 'Markdown', reply_markup: profileInlineKeyboard });
    }
});

bot.callbackQuery('action_main_menu', async (ctx) => {
    await ctx.answerCallbackQuery();
    await User.findOneAndUpdate({ telegramId: ctx.from.id }, { step: 'COMPLETED', chatTarget: null });
    await ctx.reply(`🏠 မူလမီနူးသို့ ရောက်ရှိပါပြီ။`, { reply_markup: mainReplyKeyboard });
});

bot.callbackQuery('action_delete_profile', async (ctx) => {
    await ctx.answerCallbackQuery();
    await User.findOneAndDelete({ telegramId: ctx.from.id });
    await ctx.reply(`🗑 သင်၏ အချက်အလက်များအားလုံး ဖျက်ဆီးပြီးပါပြီ။`);
});

bot.callbackQuery('action_edit_profile', async (ctx) => {
    await ctx.answerCallbackQuery();
    const editKeyboard = new InlineKeyboard()
        .text('✏️ အမည်ပြင်မယ်', 'edit_name').text('✏️ အသက်ပြင်မယ်', 'edit_age').row()
        .text('✏️ လိင်ပြင်မယ်', 'edit_gender').text('✏️ ပုံပြင်မယ်', 'edit_photo').row()
        .text('✏️ မြို့နယ်ပြင်မယ်', 'edit_location').text('✏️ Bio ပြင်မယ်', 'edit_bio');
    await ctx.reply(`⚙️ ပြင်ဆင်လိုသည့် အချက်အလက်ကို ရွေးချယ်ပါ -`, { reply_markup: editKeyboard });
});

bot.callbackQuery('edit_name', async (ctx) => { await ctx.answerCallbackQuery(); await User.findOneAndUpdate({ telegramId: ctx.from.id }, { step: 'EDIT_NAME' }); await ctx.reply(`📝 အမည်သစ် ပို့ပေးပါ -`); });
bot.callbackQuery('edit_age', async (ctx) => { await ctx.answerCallbackQuery(); await User.findOneAndUpdate({ telegramId: ctx.from.id }, { step: 'EDIT_AGE' }); await ctx.reply(`🌿 အသက်သစ် ပို့ပေးပါ -`); });
bot.callbackQuery('edit_gender', async (ctx) => { await ctx.answerCallbackQuery(); await User.findOneAndUpdate({ telegramId: ctx.from.id }, { step: 'EDIT_GENDER' }); await ctx.reply(`⏳ လိင် (1=Boy, 2=Girl, 3=Lgpt) -`); });
bot.callbackQuery('edit_photo', async (ctx) => { await ctx.answerCallbackQuery(); await User.findOneAndUpdate({ telegramId: ctx.from.id }, { step: 'EDIT_PHOTO' }); await ctx.reply(`🌻 ပုံအသစ် ပို့ပေးပါ -`); });
bot.callbackQuery('edit_location', async (ctx) => { await ctx.answerCallbackQuery(); await User.findOneAndUpdate({ telegramId: ctx.from.id }, { step: 'EDIT_LOCATION' }); await ctx.reply(`🏡 မြို့နယ်အသစ် ပို့ပေးပါ -`); });
bot.callbackQuery('edit_bio', async (ctx) => { await ctx.answerCallbackQuery(); await User.findOneAndUpdate({ telegramId: ctx.from.id }, { step: 'EDIT_BIO' }); await ctx.reply(`🤍 Bio အသစ် ပို့ပေးပါ -`); });


// ==========================================
// 6. MESSAGE LISTENER & DIRECT CHAT ROUTING
// ==========================================

bot.on('message', async (ctx) => {
    if (ctx.chat.type !== 'private') return;
    const userId = ctx.from.id;
    let dbUser = await User.findOne({ telegramId: userId });
    if (!dbUser) return;

    if (dbUser.step === 'SENDING_CHAT_MSG' && dbUser.chatTarget) {
        const targetId = dbUser.chatTarget;
        const isAccepted = dbUser.acceptedChats && dbUser.acceptedChats.includes(targetId);

        if (!isAccepted && dbUser.msgCount >= 2) {
            dbUser.step = 'COMPLETED';
            dbUser.chatTarget = null;
            await dbUser.save();
            return ctx.reply(`⚠️ ခွင့်ပြုချက်မရမီ အများဆုံး စာ (၂) ကြောင်းသာ ပို့ခွင့်ရှိပါသည်။ တစ်ဖက်လူမှ လက်ခံအောင် စောင့်ဆိုင်းပေးပါရှင့်။`, { reply_markup: mainReplyKeyboard });
        }

        const acceptKeyboard = new InlineKeyboard()
            .text('✅ စကားပြောရန် လက်ခံမည်', `accept_chat_${userId}`)
            .text('❌ လက်မခံပါ (Block)', `decline_chat_${userId}`);

        try {
            if (isAccepted) {
                await ctx.api.sendMessage(targetId, `💬 **${dbUser.name}:** ${ctx.message.text}`);
            } else {
                await ctx.api.sendMessage(targetId, `📩 **${dbUser.name} ဆီမှ ပေးပို့လာသော စာ (စာကြောင်းရေ ${dbUser.msgCount + 1}/2):**\n\n"${ctx.message.text}"`, { reply_markup: acceptKeyboard });
            }

            dbUser.msgCount += 1;
            await dbUser.save();
            return ctx.reply(`✅ စာ ပို့ဆောင်ပြီးပါပြီ! (${isAccepted ? 'တိုက်ရိုက်' : `စာကြောင်းရေ ${dbUser.msgCount}/2`})`);
        } catch (err) {
            return ctx.reply(`❌ စာ ပို့၍မရပါ။`);
        }
    }

    // --- REGISTRATION STEPS ---
    if (dbUser.step === 'REG_NAME') {
        dbUser.name = ctx.message.text; dbUser.step = 'REG_AGE'; await dbUser.save();
        return ctx.reply(`⏳ သင့်အသက်ကိုရေးပေးပါရှင့်`);
    }
    else if (dbUser.step === 'REG_AGE') {
        dbUser.age = ctx.message.text; dbUser.step = 'REG_GENDER'; await dbUser.save();
        return ctx.reply(`⏳သင့်အမျိုးအစားကိုရေးပေးပါရှင့် (1=Boy, 2=Girl, 3=Lgpt)`);
    }
    else if (dbUser.step === 'REG_GENDER') {
        let val = ctx.message.text;
        dbUser.genderType = val === '1' ? 'Boy 🤴' : val === '2' ? 'Girl 👸' : 'Lgpt 🌈';
        dbUser.step = 'REG_PHOTO'; await dbUser.save();
        return ctx.reply(`⏳သင့်photo(1) ပုံလောက်ပို့ပေးပါရှင့်`);
    }
    else if (dbUser.step === 'REG_PHOTO') {
        if (!ctx.message.photo) return ctx.reply('❌ ဓာတ်ပုံ ပို့ပေးပါ။');
        dbUser.photoFileId = ctx.message.photo[ctx.message.photo.length - 1].file_id;
        dbUser.step = 'REG_LOCATION'; await dbUser.save();
        return ctx.reply(`⏳သင့်နေထိုင်ရာမြို့နယ်ကို ရေးပေးပါရှင့်။`);
    }
    else if (dbUser.step === 'REG_LOCATION') {
        dbUser.locationText = ctx.message.text; dbUser.step = 'REG_BIO'; await dbUser.save();
        return ctx.reply(`⏳သင့်ရဲ့အကြောင်းအရာ (Bio) ကို ရေးပေးပါရှင့်`);
    }
    else if (dbUser.step === 'REG_BIO') {
        dbUser.bio = ctx.message.text; dbUser.step = 'COMPLETED'; await dbUser.save();
        return ctx.reply(`⌛အတည်ပြုပြီးပါပြီ ℋℯ𝒶𝓇𝓉ℳ𝒶𝓉𝒸𝒽မှ ကြိုဆိုပါတယ်💌`, { reply_markup: mainReplyKeyboard });
    }

    // Edit Steps
    else if (dbUser.step === 'EDIT_NAME') {
        dbUser.name = ctx.message.text; dbUser.step = 'COMPLETED'; await dbUser.save();
        return ctx.reply(`✅ အမည် ပြင်ဆင်ပြီးပါပြီ။`, { reply_markup: mainReplyKeyboard });
    }
    else if (dbUser.step === 'EDIT_AGE') {
        dbUser.age = ctx.message.text; dbUser.step = 'COMPLETED'; await dbUser.save();
        return ctx.reply(`✅ အသက် ပြင်ဆင်ပြီးပါပြီ။`, { reply_markup: mainReplyKeyboard });
    }
    else if (dbUser.step === 'EDIT_GENDER') {
        let val = ctx.message.text;
        dbUser.genderType = val === '1' ? 'Boy 🤴' : val === '2' ? 'Girl 👸' : 'Lgpt 🌈';
        dbUser.step = 'COMPLETED'; await dbUser.save();
        return ctx.reply(`✅ လိင်အမျိုးအစား ပြင်ဆင်ပြီးပါပြီ။`, { reply_markup: mainReplyKeyboard });
    }
    else if (dbUser.step === 'EDIT_PHOTO') {
        if (!ctx.message.photo) return ctx.reply('❌ ပုံ ပို့ပေးပါ။');
        dbUser.photoFileId = ctx.message.photo[ctx.message.photo.length - 1].file_id;
        dbUser.step = 'COMPLETED'; await dbUser.save();
        return ctx.reply(`✅ ပုံ ပြင်ဆင်ပြီးပါပြီ။`, { reply_markup: mainReplyKeyboard });
    }
    else if (dbUser.step === 'EDIT_LOCATION') {
        dbUser.locationText = ctx.message.text; dbUser.step = 'COMPLETED'; await dbUser.save();
        return ctx.reply(`✅ မြို့နယ် ပြင်ဆင်ပြီးပါပြီ။`, { reply_markup: mainReplyKeyboard });
    }
    else if (dbUser.step === 'EDIT_BIO') {
        dbUser.bio = ctx.message.text; dbUser.step = 'COMPLETED'; await dbUser.save();
        return ctx.reply(`✅ Bio ပြင်ဆင်ပြီးပါပြီ။`, { reply_markup: mainReplyKeyboard });
    }
});

bot.start();

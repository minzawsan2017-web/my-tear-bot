require('dotenv').config();
const { Bot, InlineKeyboard, Keyboard, HttpError } = require('grammy');
const mongoose = require('mongoose');
const express = require('express');
const { User, Setting } = require('./models');

const bot = new Bot(process.env.BOT_TOKEN);
const OWNER_ID = Number(process.env.OWNER_ID);

// 📌 Bot Error Handling
bot.catch((err) => {
    const ctx = err.ctx;
    console.error(`Error handling update ${ctx.update.update_id}:`);
    const e = err.error;
    if (e instanceof HttpError) {
        console.error("Telegram API Error:", e.description);
    } else {
        console.error("Unknown error:", e);
    }
});

process.on('uncaughtException', (err) => { console.error('Uncaught Exception:', err); });
process.on('unhandledRejection', (reason, promise) => { console.error('Unhandled Rejection:', reason); });

// MongoDB ချိတ်ဆက်ခြင်း
mongoose.connect(process.env.MONGO_URI).then(() => {
    console.log('Connected to MongoDB successfully!');
}).catch(err => console.error('MongoDB connection error:', err));

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

// Group/Channel Join စစ်ဆေးသည့် တင်းကျပ်သော Function
async function checkUserSubscription(ctx, userId) {
    if (userId === OWNER_ID) return true;
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
// 1. OWNER COMMANDS & FAKE PROFILE BUILDER
// ==========================================

bot.command('HeartMatchstartinfo', async (ctx) => {
    if (ctx.chat.type !== 'private' || ctx.from.id !== OWNER_ID) return ctx.reply('❌ Owner သာ အသုံးပြုနိုင်ပါသည်။');
    const replyMsg = ctx.message.reply_to_message;
    if (!replyMsg || (!replyMsg.photo && !replyMsg.video)) return ctx.reply('❌ ပုံ သို့မဟုတ် ဗီဒီယိုကို Reply ထောက်ပါ။');
    let fileId = replyMsg.photo ? replyMsg.photo[replyMsg.photo.length - 1].file_id : replyMsg.video.file_id;
    let mediaType = replyMsg.photo ? 'photo' : 'video';

    await Setting.findOneAndUpdate({ key: 'start_media' }, { key: 'start_media', type: mediaType, fileId: fileId }, { upsert: true });
    return ctx.reply('✅ Start Media သိမ်းဆည်းပြီးပါပြီ။');
});

bot.command('Delstartheart', async (ctx) => {
    if (ctx.chat.type !== 'private' || ctx.from.id !== OWNER_ID) return ctx.reply('❌ Owner သာ အသုံးပြုနိုင်ပါသည်။');
    await Setting.deleteOne({ key: 'start_media' });
    return ctx.reply('🗑 Start Media ကို ဖျက်ပြီးပါပြီ။');
});

bot.command('startlinkGroup', async (ctx) => {
    if (ctx.chat.type !== 'private' || ctx.from.id !== OWNER_ID) return ctx.reply('❌ Owner သာ အသုံးပြုနိုင်ပါသည်။');
    const args = ctx.match.trim().split(' ');
    await Setting.findOneAndUpdate({ key: 'group_link' }, { key: 'group_link', type: 'link', link: args[0], chatId: args[1] ? Number(args[1]) : null }, { upsert: true });
    return ctx.reply('✅ Group Link သတ်မှတ်ပြီးပါပြီ။');
});

bot.command('startgpdel', async (ctx) => {
    if (ctx.chat.type !== 'private' || ctx.from.id !== OWNER_ID) return ctx.reply('❌ Owner သာ အသုံးပြုနိုင်ပါသည်။');
    await Setting.deleteOne({ key: 'group_link' });
    return ctx.reply('🗑 Group Link ဖျက်ပြီးပါပြီ။');
});

bot.command('startlinkChannel', async (ctx) => {
    if (ctx.chat.type !== 'private' || ctx.from.id !== OWNER_ID) return ctx.reply('❌ Owner သာ အသုံးပြုနိုင်ပါသည်။');
    const args = ctx.match.trim().split(' ');
    await Setting.findOneAndUpdate({ key: 'channel_link' }, { key: 'channel_link', type: 'link', link: args[0], chatId: args[1] ? Number(args[1]) : null }, { upsert: true });
    return ctx.reply('✅ Channel Link သတ်မှတ်ပြီးပါပြီ။');
});

bot.command('startchdel', async (ctx) => {
    if (ctx.chat.type !== 'private' || ctx.from.id !== OWNER_ID) return ctx.reply('❌ Owner သာ အသုံးပြုနိုင်ပါသည်။');
    await Setting.deleteOne({ key: 'channel_link' });
    return ctx.reply('🗑 Channel Link ဖျက်ပြီးပါပြီ။');
});

bot.command('setMatchGroup', async (ctx) => {
    if (ctx.chat.type !== 'private' || ctx.from.id !== OWNER_ID) return ctx.reply('❌ Owner သာ အသုံးပြုနိုင်ပါသည်။');
    await Setting.findOneAndUpdate({ key: 'match_group_link' }, { key: 'match_group_link', type: 'link', link: ctx.match }, { upsert: true });
    return ctx.reply('✅ Match Group Link သတ်မှတ်ပြီးပါပြီ။');
});

bot.command('totalusers', async (ctx) => {
    if (ctx.chat.type !== 'private' || ctx.from.id !== OWNER_ID) return ctx.reply('❌ Owner သာ အသုံးပြုနိုင်ပါသည်။');
    const totalCount = await User.countDocuments({ step: 'COMPLETED' });
    return ctx.reply(`📊 လက်ရှိ ဘော့တ်တွင် စာရင်းသွင်းပြီးသူ စုစုပေါင်း: **လူ ${totalCount} ယောက်** ရှိပါသည်။`, { parse_mode: 'Markdown' });
});

bot.command('clearallusers', async (ctx) => {
    if (ctx.chat.type !== 'private' || ctx.from.id !== OWNER_ID) return ctx.reply('❌ Owner သာ အသုံးပြုနိုင်ပါသည်။');
    await User.deleteMany({});
    return ctx.reply('🗑 Database ထဲရှိ စာရင်းသွင်းထားသော User အားလုံးကို အောင်မြင်စွာ ဖျက်ဆီးလိုက်ပါပြီ။');
});

bot.command('deluser', async (ctx) => {
    if (ctx.chat.type !== 'private' || ctx.from.id !== OWNER_ID) return ctx.reply('❌ Owner သာ အသုံးပြုနိုင်ပါသည်။');
    const targetId = Number(ctx.match.trim());
    if (!targetId) return ctx.reply('❌ ဖျက်လိုသည့် User ၏ ID ထည့်ပါ။ ဥပမာ - /deluser 123456789');

    const deleted = await User.findOneAndDelete({ telegramId: targetId });
    if (!deleted) return ctx.reply(`❌ ဤ ID (${targetId}) ဖြင့် User မတွေ့ပါ။`);
    return ctx.reply(`✅ User ID (${targetId}) ကို ဖျက်ပြီးပါပြီ။`);
});

// 📌 Owner က Fake Profile အသစ် စတင်ထည့်သွင်းရန် (/addfake)
bot.command('addfake', async (ctx) => {
    if (ctx.chat.type !== 'private' || ctx.from.id !== OWNER_ID) return ctx.reply('❌ Owner သာ အသုံးပြုနိုင်ပါသည်။');
    
    const count = await User.countDocuments({ isFake: true });
    const fakeNumber = count + 1; // 順番အတိုင်း နံပါတ်စဉ်ပေးမည် (ဥပမာ- 1, 2, 3...)
    const fakeId = 900000000 + fakeNumber;

    await User.findOneAndUpdate(
        { telegramId: fakeId },
        { 
            telegramId: fakeId, 
            isFake: true, 
            fakeIndex: fakeNumber,
            step: 'FAKE_NAME',
            likesCount: [],
            nextsCount: [],
            myLikes: []
        },
        { upsert: true }
    );

    await ctx.reply(`🤖 **Fake Profile အသစ် ဖန်တီးခြင်း (နံပါတ် - ${fakeNumber})**\n\nကျေးဇူးပြု၍ ဤ Fake Profile ၏ **အမည် (Name)** ကို ရေးပြီး ပို့ပေးပါရှင့် 📝`, { parse_mode: 'Markdown' });
});

// 📌 Owner က Fake Profile များကို နံပါတ်အလိုက် ကြည့်ရှု၊ ပြင်ဆင်၊ ဖျက်ဆီးရန် (/fake 1)
bot.command('fake', async (ctx) => {
    if (ctx.chat.type !== 'private' || ctx.from.id !== OWNER_ID) return ctx.reply('❌ Owner သာ အသုံးပြုနိုင်ပါသည်။');
    
    const arg = ctx.match.trim();
    if (!arg) {
        // ထည့်ထားသမျှ Fake Profile စာရင်းအားလုံးကို ပြပေးမည်
        const fakes = await User.find({ isFake: true }).sort({ fakeIndex: 1 });
        if (fakes.length === 0) return ctx.reply(`📭 လက်တိမာ ဖန်တီးထားသော Fake Profile မရှိသေးပါ။ /addfake ဖြင့် အသစ်ထည့်ပါ။`);
        
        let listText = `📋 **Owner ၏ Fake Profiles စာရင်းများ:**\n------------------------------------\n`;
        fakes.forEach(f => {
            listText += `🔹 နံပါတ် (${f.fakeIndex}) - ${f.name} (${f.age}နှစ်, ${f.genderType})\n`;
        });
        listText += `------------------------------------\n💡 အသေးစိတ်ကြည့်ရန်/ပြင်ရန်: <code>/fake 1</code> ဟု ရိုက်ပါ။`;
        return ctx.reply(listText, { parse_mode: 'HTML' });
    }

    const fakeNum = Number(arg);
    const targetFake = await User.findOne({ isFake: true, fakeIndex: fakeNum });
    if (!targetFake) return ctx.reply(`❌ နံပါတ် (${fakeNum}) ဖြင့် Fake Profile ရှာမတွေ့ပါ။`);

    const fakeDetails = 
`🤖 **Fake Profile အချက်အလက် (နံပါတ် - ${fakeNum})**
------------------------------------
📝 အမည် - ${targetFake.name}
🌿 အသက် - ${targetFake.age} နှစ်
🌷 လိင် - ${targetFake.genderType}
🏡 မြို့နယ် - ${targetFake.locationText}
🤍 Bio - ${targetFake.bio}
------------------------------------`;

    const manageKeyboard = new InlineKeyboard()
        .text('🗑 ဤ Fake Profile ဖျက်မည်', `del_fake_${targetFake.telegramId}`).row()
        .text('🏠 မူလမီနူးသို့', 'action_main_menu');

    if (targetFake.photoFileId) {
        await ctx.replyWithPhoto(targetFake.photoFileId, { caption: fakeDetails, parse_mode: 'Markdown', reply_markup: manageKeyboard });
    } else {
        await ctx.reply(fakeDetails, { parse_mode: 'Markdown', reply_markup: manageKeyboard });
    }
});

// Fake Profile ဖျက်မည့် Callback
bot.callbackQuery(/^del_fake_(\d+)$/, async (ctx) => {
    try { await ctx.answerCallbackQuery(); } catch(e) {}
    const fakeTelegramId = Number(ctx.match[1]);
    await User.findOneAndDelete({ telegramId: fakeTelegramId, isFake: true });
    await ctx.reply(`🗑 ဤ Fake Profile ကို အောင်မြင်စွာ ဖျက်ဆီးလိုက်ပါပြီ။`);
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
        if (!isJoined) {
            return ctx.reply(`❌ ကျေးဇူးပြု၍ သတ်မှတ်ထားသော Group နှင့် Channel များကို မပျက်မကွက် Join ပေးပါမှ Bot ကို ဆက်သုံးလို့ရပါမယ်ရှင့်။`);
        }
        return ctx.reply(`✨ မင်္ဂလာပါ ${dbUser.name}၊ ပြန်လည်ကြိုဆိုပါတယ်!`, { reply_markup: mainReplyKeyboard });
    }

    if (userId !== OWNER_ID) {
        await User.findOneAndUpdate({ telegramId: userId }, { step: 'IDLE' }, { upsert: true });
    }

    const startMedia = await Setting.findOne({ key: 'start_media' });
    const loveLink = "https://t.me/HeartMatch_CUPID_Bot"; 
    const captionText = 
`📮မဂ်လာပါℋℯ𝒶𝓇ᵗℳ𝒶𝓉𝒸𝒽--ᴄᴜᴘɪᴅ💗မှ
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
    try { await ctx.answerCallbackQuery(); } catch(e) {}
    const userId = ctx.from.id;
    const isJoined = await checkUserSubscription(ctx, userId);

    if (!isJoined) {
        try {
            await ctx.answerCallbackQuery({ text: "❌ ကျေးဇူးပြု၍ Group နှင့် Channel ကို အရင် Join ပေးပါရှင့်!", show_alert: true });
        } catch(e) {
            await ctx.reply("❌ ကျေးဇူးပြု၍ Group နှင့် Channel ကို အရင် Join ပေးပါရှင့်!");
        }
        return;
    }

    await User.findOneAndUpdate({ telegramId: userId }, { step: 'REG_NAME' });
    await ctx.reply(`⏳အမည်အရင်း(သို့)ကြိုနှစ်သက်ရာအမည်\n       ရေးပီးပို့ပေးပါရှင့် 🗒 \n----ℋℯ𝒶𝓇ᵗℳ𝒶𝓉𝒸𝒽-----`);
});


// ==========================================
// 3. CHAT FEATURE
// ==========================================

bot.hears('💬 Chat', async (ctx) => {
    if (ctx.chat.type !== 'private') return;
    const userId = ctx.from.id;

    const isJoined = await checkUserSubscription(ctx, userId);
    if (!isJoined) return ctx.reply(`⚠️ ကျေးဇူးပြု၍ Group နှင့် Channel ကို အရင် Join ပေးပါရှင့်။`);

    const user = await User.findOne({ telegramId: userId });
    if (!user) return ctx.reply(`❌ ကျေးဇူးပြု၍ /start ဖြင့် အရင် စာရင်းသွင်းပါ။`);

    const combinedList = Array.from(new Set([...(user.myLikes || []), ...(user.likedBy || [])]));

    if (combinedList.length === 0) {
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
        .text('⏭ Skip (နောက်တစ်ယောက်)', `skip_chat_${index + 1}`);

    if (targetUser.photoFileId) {
        await ctx.replyWithPhoto(targetUser.photoFileId, { caption: caption, parse_mode: 'Markdown', reply_markup: chatKeyboard });
    } else {
        await ctx.reply(caption, { parse_mode: 'Markdown', reply_markup: chatKeyboard });
    }
}

bot.callbackQuery(/^skip_chat_(\d+)$/, async (ctx) => {
    try { await ctx.answerCallbackQuery(); } catch(e) {}
    const userId = ctx.from.id;
    const isJoined = await checkUserSubscription(ctx, userId);
    if (!isJoined) return ctx.reply(`⚠️ Group နှင့် Channel ကို အရင် Join ပေးပါရှင့်။`);

    const user = await User.findOne({ telegramId: userId });
    const combinedList = Array.from(new Set([...(user.myLikes || []), ...(user.likedBy || [])]));
    const nextIndex = Number(ctx.match[1]);

    await showMatchedUserForChat(ctx, userId, combinedList, nextIndex);
});

bot.callbackQuery(/^type_msg_(\d+)$/, async (ctx) => {
    try { await ctx.answerCallbackQuery(); } catch(e) {}
    const targetId = Number(ctx.match[1]);
    const userId = ctx.from.id;

    const isJoined = await checkUserSubscription(ctx, userId);
    if (!isJoined) return ctx.reply(`⚠️ ကျေးဇူးပြု၍ Group နှင့် Channel ကို အရင် Join ပေးပါရှင့်။`);

    const sender = await User.findOne({ telegramId: userId });
    if (sender.blockedChats && sender.blockedChats.includes(targetId)) {
        return ctx.reply(`⚠️ သင့်အား ဤ Profile မှ ငြင်းပယ်ထားပါသည် (Block ထားပါသည်)။`);
    }

    await User.findOneAndUpdate({ telegramId: userId }, { step: 'SENDING_CHAT_MSG', chatTarget: targetId, msgCount: 0 });

    const stopKeyboard = new InlineKeyboard()
        .text('⛔ Dchat (စာဆက်မပို့တော့ပါ)', 'stop_chat_session');

    await ctx.reply(
        `💌 စာစတင်ပို့နိုင်ပါပြီ။ (တစ်ဖက်လူမှ လက်မခံသေးမီ အများဆုံး စာ ၂ ကြောင်းသာ ပို့ခွင့်ရပါမည်)\n\n` +
        `🛑 **စာဆက်မပို့လိုပါက အောက်ပါ "⛔ Dchat" ခလုတ်ကို နှိပ်ပါ**\n\n` +
        `👇 ယခု စာစတင် ရေးသားပါ -`,
        { reply_markup: stopKeyboard }
    );
});

bot.callbackQuery('stop_chat_session', async (ctx) => {
    try { await ctx.answerCallbackQuery(); } catch(e) {}
    const userId = ctx.from.id;
    await User.findOneAndUpdate({ telegramId: userId }, { step: 'COMPLETED', chatTarget: null });
    await ctx.reply(`🛑 စာပို့ခြင်းကို ရပ်တန့်လိုက်ပါပြီ။`, { reply_markup: mainReplyKeyboard });
});

bot.callbackQuery(/^accept_chat_(\d+)$/, async (ctx) => {
    try { await ctx.answerCallbackQuery(); } catch(e) {}
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
    try { await ctx.answerCallbackQuery(); } catch(e) {}
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
    try { await ctx.answerCallbackQuery(); } catch(e) {}
    const userId = ctx.from.id;
    const isJoined = await checkUserSubscription(ctx, userId);
    if (!isJoined) return ctx.reply(`⚠️ Group နှင့် Channel ကို အရင် Join ပေးပါရှင့်။`);

    const targetId = Number(ctx.match[1]);
    const mode = ctx.match[2];
    const senderId = userId;

    await User.findOneAndUpdate({ telegramId: senderId }, { $addToSet: { myLikes: targetId } });
    await User.findOneAndUpdate({ telegramId: targetId }, { $addToSet: { likesCount: senderId, likedBy: senderId } });

    const targetUser = await User.findOne({ telegramId: targetId });
    if (targetUser && targetUser.isFake) {
        try {
            await bot.api.sendMessage(OWNER_ID, 
                `💖 **Fake Profile (${targetUser.name}) ထံသို့ Like ရောက်ရှိလာပါပြီ!**\n\n` +
                `👤 Like ပေးသူ ID: <code>${senderId}</code>\n` +
                `👤 အမည်: ${currentUserInfoText(senderId)}`,
                { parse_mode: 'HTML' }
            );
        } catch(err) {}
    }

    await ctx.reply(`⌛ အတည်ပြုပြီးပါပြီ။ သင်၏ Like စာရင်းထဲသို့ ထည့်ပြီးပါပြီ 💌`, { reply_markup: mainReplyKeyboard });
    await searchAndShowCandidate(ctx, mode, [targetId]);
});

bot.callbackQuery(/^next_(\d+)_(dating|friend|game)$/, async (ctx) => {
    try { await ctx.answerCallbackQuery(); } catch(e) {}
    const userId = ctx.from.id;
    const isJoined = await checkUserSubscription(ctx, userId);
    if (!isJoined) return ctx.reply(`⚠️ Group နှင့် Channel ကို အရင် Join ပေးပါရှင့်။`);

    const currentCandidateId = Number(ctx.match[1]);
    const mode = ctx.match[2];
    
    await User.findOneAndUpdate(
        { telegramId: currentCandidateId }, 
        { $addToSet: { nextsCount: userId } }
    );

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
        .text('🗑 ကိုယ်အကြောင်းအချက်အလက် အကုန်ဖျက်ရန်', 'action_delete_profile');

    if (user.photoFileId) {
        await ctx.replyWithPhoto(user.photoFileId, { caption: profileText, parse_mode: 'Markdown', reply_markup: profileInlineKeyboard });
    } else {
        await ctx.reply(profileText, { parse_mode: 'Markdown', reply_markup: profileInlineKeyboard });
    }
});

bot.callbackQuery('action_delete_profile', async (ctx) => {
    try { await ctx.answerCallbackQuery(); } catch(e) {}
    await User.findOneAndDelete({ telegramId: ctx.from.id });
    await ctx.reply(`🗑 သင်၏ အချက်အလက်များအားလုံး ဖျက်ဆီးပြီးပါပြီ။`);
});

bot.callbackQuery('action_edit_profile', async (ctx) => {
    try { await ctx.answerCallbackQuery(); } catch(e) {}
    const editKeyboard = new InlineKeyboard()
        .text('✏️ အမည်ပြင်မယ်', 'edit_name').text('✏️ အသက်ပြင်မယ်', 'edit_age').row()
        .text('✏️ လိင်ပြင်မယ်', 'edit_gender').text('✏️ ပုံပြင်မယ်', 'edit_photo').row()
        .text('✏️ မြို့နယ်ပြင်မယ်', 'edit_location').text('✏️ Bio ပြင်မယ်', 'edit_bio');
    await ctx.reply(`⚙️ ပြင်ဆင်လိုသည့် အချက်အလက်ကို ရွေးချယ်ပါ -`, { reply_markup: editKeyboard });
});

bot.callbackQuery('edit_name', async (ctx) => { try { await ctx.answerCallbackQuery(); } catch(e){} await User.findOneAndUpdate({ telegramId: ctx.from.id }, { step: 'EDIT_NAME' }); await ctx.reply(`📝 အမည်သစ် ပို့ပေးပါ -`); });
bot.callbackQuery('edit_age', async (ctx) => { try { await ctx.answerCallbackQuery(); } catch(e){} await User.findOneAndUpdate({ telegramId: ctx.from.id }, { step: 'EDIT_AGE' }); await ctx.reply(`🌿 အသက်သစ် ပို့ပေးပါ -`); });
bot.callbackQuery('edit_gender', async (ctx) => { try { await ctx.answerCallbackQuery(); } catch(e){} await User.findOneAndUpdate({ telegramId: ctx.from.id }, { step: 'EDIT_GENDER' }); await ctx.reply(`⏳ လိင် (1=Boy, 2=Girl, 3=Lgpt) -`); });
bot.callbackQuery('edit_photo', async (ctx) => { try { await ctx.answerCallbackQuery(); } catch(e){} await User.findOneAndUpdate({ telegramId: ctx.from.id }, { step: 'EDIT_PHOTO' }); await ctx.reply(`🌻 ပုံအသစ် ပို့ပေးပါ -`); });
bot.callbackQuery('edit_location', async (ctx) => { try { await ctx.answerCallbackQuery(); } catch(e){} await User.findOneAndUpdate({ telegramId: ctx.from.id }, { step: 'EDIT_LOCATION' }); await ctx.reply(`🏡 မြို့နယ်အသစ် ပို့ပေးပါ -`); });
bot.callbackQuery('edit_bio', async (ctx) => { try { await ctx.answerCallbackQuery(); } catch(e){} await User.findOneAndUpdate({ telegramId: ctx.from.id }, { step: 'EDIT_BIO' }); await ctx.reply(`🤍 Bio အသစ် ပို့ပေးပါ -`); });


// ==========================================
// 6. MESSAGE LISTENER & FAKE PROFILE CREATION FLOW
// ==========================================

bot.on('message', async (ctx) => {
    if (ctx.chat.type !== 'private') return;
    const userId = ctx.from.id;

    let dbUser = await User.findOne({ telegramId: userId });

    if (userId === OWNER_ID && dbUser && dbUser.isFake && dbUser.step !== 'COMPLETED') {
        if (dbUser.step === 'FAKE_NAME') {
            dbUser.name = ctx.message.text;
            dbUser.step = 'FAKE_AGE';
            await dbUser.save();
            return ctx.reply(`🌿 ဤ Fake Profile ၏ **အသက် (Age)** ကို ရေးပြီး ပို့ပေးပါ -`, { parse_mode: 'Markdown' });
        }
        else if (dbUser.step === 'FAKE_AGE') {
            dbUser.age = ctx.message.text;
            dbUser.step = 'FAKE_GENDER';
            await dbUser.save();
            return ctx.reply(`🌷 လိင်အမျိုးအစား ရွေးပါ (1 = Boy 🤴, 2 = Girl 👸, 3 = Lgpt 🌈) -`);
        }
        else if (dbUser.step === 'FAKE_GENDER') {
            let val = ctx.message.text;
            dbUser.genderType = val === '1' ? 'Boy 🤴' : val === '2' ? 'Girl 👸' : 'Lgpt 🌈';
            dbUser.step = 'FAKE_PHOTO';
            await dbUser.save();
            return ctx.reply(`🌻 ဤ Fake Profile ၏ **ဓာတ်ပုံ (1ပုံ)** ပို့ပေးပါ -`, { parse_mode: 'Markdown' });
        }
        else if (dbUser.step === 'FAKE_PHOTO') {
            if (!ctx.message.photo) return ctx.reply('❌ ကျေးဇူးပြု၍ ဓာတ်ပုံ ပို့ပေးပါ။');
            dbUser.photoFileId = ctx.message.photo[ctx.message.photo.length - 1].file_id;
            dbUser.step = 'FAKE_LOCATION';
            await dbUser.save();
            return ctx.reply(`🏡 နေထိုင်ရာ မြို့နယ်ကို ရေးပေးပါ -`);
        }
        else if (dbUser.step === 'FAKE_LOCATION') {
            dbUser.locationText = ctx.message.text;
            dbUser.step = 'FAKE_BIO';
            await dbUser.save();
            return ctx.reply(`🤍 ဤ Fake Profile ၏ **Bio** အကြောင်းအရာကို ရေးပေးပါ -`, { parse_mode: 'Markdown' });
        }
        else if (dbUser.step === 'FAKE_BIO') {
            dbUser.bio = ctx.message.text;
            dbUser.step = 'COMPLETED';
            await dbUser.save();
            return ctx.reply(`✅ **Fake Profile (နံပါတ် - ${dbUser.fakeIndex}) အောင်မြင်စွာ ဖန်တီးပြီးစီးပါပြီ!** 🎉\n`/fake ${dbUser.fakeIndex}` ဟု ရိုက်၍ ပြန်လည်စစ်ဆေးနိုင်ပါသည်။`, { parse_mode: 'Markdown', reply_markup: mainReplyKeyboard });
        }
    }

    const isJoined = await checkUserSubscription(ctx, userId);
    if (!isJoined) return ctx.reply(`⚠️ ကျေးဇူးပြု၍ Group နှင့် Channel ကို အရင် Join ပေးပါရှင့်။`);

    if (!dbUser) return;

    if (dbUser.step === 'SENDING_CHAT_MSG' && dbUser.chatTarget) {
        const targetId = dbUser.chatTarget;
        const targetUser = await User.findOne({ telegramId: targetId });

        if (targetUser && targetUser.isFake) {
            try {
                await bot.api.sendMessage(OWNER_ID, 
                    `📩 **Fake Profile (${targetUser.name}) ထံသို့ စာရောက်ရှိလာပါပြီ!**\n\n` +
                    `👤 ပို့သူ အမည်: ${dbUser.name}\n` +
                    `🆔 ပို့သူ ID: <code>${userId}</code>\n` +
                    `💬 ပို့လာသောစာ: "${ctx.message.text}"`,
                    { parse_mode: 'HTML' }
                );
                return ctx.reply(`✅ စာ ပို့ဆောင်ပြီးပါပြီ! Owner မှ သင့်ထံသို့ ပြန်လည်ဆက်သွယ်ပေးပါလိမ့်မည်။`, { reply_markup: mainReplyKeyboard });
            } catch (err) {
                return ctx.reply(`❌ စာ ပို့၍မရပါ။`);
            }
        }

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
        return ctx.reply(`⌛အတည်ပြုပြီးပါပြီ ℋℯ𝒶𝓇ᵗℳ𝒶𝓉𝒸𝒽မှ ကြိုဆိုပါတယ်💌`, { reply_markup: mainReplyKeyboard });
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

function currentUserInfoText(id) {
    return `ID: ${id}`;
}

// 📌 Bot ကို အမှားကင်းစင်စွာ စတင်ခြင်း
bot.start();

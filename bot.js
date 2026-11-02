require('dotenv').config();
const { Bot, InlineKeyboard, Keyboard } = require('grammy');
const mongoose = require('mongoose');
const express = require('express');
const { User, Setting } = require('./models');

const bot = new Bot(process.env.BOT_TOKEN);
const OWNER_ID = Number(process.env.OWNER_ID);

// MongoDB ချိတ်ဆက်ခြင်း
mongoose.connect(process.env.MONGO_URI).then(() => {
    console.log('Connected to MongoDB successfully!');
});

// Express Server (UptimeRobot အတွက် Keep-Alive ရန်)
const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('HeartMatch CUPID Bot is running alive! 💖'));
app.listen(PORT, () => console.log(`Server is listening on port ${PORT}`));

// အကွာအဝေး (KM) တွက်ချက်ခြင်း (Haversine Formula)
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

// 📌 Group/Channel Join ထားခြင်း ရှိမရှိ စစ်ဆေးပေးသည့် Helper Function
async function checkUserSubscription(ctx, userId) {
    const groupSetting = await Setting.findOne({ key: 'group_link' });
    const channelSetting = await Setting.findOne({ key: 'channel_link' });

    let isGroupJoined = true;
    let isChannelJoined = true;

    try {
        if (groupSetting && groupSetting.chatId) {
            const gMember = await ctx.api.getChatMember(groupSetting.chatId, userId);
            isGroupJoined = ['creator', 'administrator', 'member'].includes(gMember.status);
        }
        if (channelSetting && channelSetting.chatId) {
            const cMember = await ctx.api.getChatMember(channelSetting.chatId, userId);
            isChannelJoined = ['creator', 'administrator', 'member'].includes(cMember.status);
        }
    } catch (err) {
        console.log("Chat Member Check Error: ", err);
    }

    return isGroupJoined && isChannelJoined;
}

// Reply Keyboard
const mainReplyKeyboard = new Keyboard()
    .requestLocation('📍 တည်နေရာပေးပို့မည်').row()
    .text('💘 ရည်းစားရှာမယ်').text('🤝 Just Friend ရှာမယ်').row()
    .text('🎮 ဂိမ်းဆော့ဖော်ရှာမယ်').text('💌 ငါ့ကိုသဘောကျသူများ').row()
    .text('👤 မိမိ Profile').text('⚙️ ကိုယ်ရေးအချက်အလက် ပြင်ရန်')
    .resized()
    .persistent();


// ==========================================
// 1. OWNER COMMANDS (Media & Links Management)
// ==========================================

bot.command('HeartMatchstartinfo', async (ctx) => {
    if (ctx.chat.type !== 'private') return;
    if (ctx.from.id !== OWNER_ID) return ctx.reply('❌ Owner သာ အသုံးပြုနိုင်ပါသည်။');
    const replyMsg = ctx.message.reply_to_message;
    if (!replyMsg || (!replyMsg.photo && !replyMsg.video)) {
        return ctx.reply('❌ ပုံ သို့မဟုတ် ဗီဒီယိုကို Reply ထောက်၍ အသုံးပြုပါ။');
    }
    let fileId = replyMsg.photo ? replyMsg.photo[replyMsg.photo.length - 1].file_id : replyMsg.video.file_id;
    let mediaType = replyMsg.photo ? 'photo' : 'video';

    let existing = await Setting.findOne({ key: 'start_media' });
    if (existing) return ctx.reply('HeartMatchinfoမှာအရင်ကရှိပါသဖြင့်အဟောင်းကိုဖျက်ရန် /Delstartheart 💓');

    await Setting.create({ key: 'start_media', type: mediaType, fileId: fileId });
    return ctx.reply('✅ Start Media အောင်မြင်စွာ သိမ်းဆည်းပြီးပါပြီ။');
});

bot.command('viweheartmatchstartinfo', async (ctx) => {
    if (ctx.chat.type !== 'private') return;
    const setting = await Setting.findOne({ key: 'start_media' });
    if (!setting) return ctx.reply('❌ သတ်မှတ်ထားသော Start Media မရှိပါ။');
    if (setting.type === 'photo') await ctx.replyWithPhoto(setting.fileId);
    else await ctx.replyWithVideo(setting.fileId);
});

bot.command('Delstartheart', async (ctx) => {
    if (ctx.chat.type !== 'private') return;
    if (ctx.from.id !== OWNER_ID) return ctx.reply('❌ Owner သာ အသုံးပြုနိုင်ပါသည်။');
    await Setting.deleteOne({ key: 'start_media' });
    return ctx.reply('🗑 Start Media ကို ဖျက်ပြီးပါပြီ။');
});

bot.command('startlinkGroup', async (ctx) => {
    if (ctx.chat.type !== 'private') return;
    if (ctx.from.id !== OWNER_ID) return ctx.reply('❌ Owner သာ အသုံးပြုနိုင်ပါသည်။');
    const args = ctx.match.split(' ');
    const link = args[0];
    const chatId = args[1] ? Number(args[1]) : null;
    if (!link) return ctx.reply('❌ ပုံစံမမှန်ပါ။ ဥပမာ - /startlinkGroup https://t.me/... -100xxx');
    await Setting.findOneAndUpdate({ key: 'group_link' }, { key: 'group_link', type: 'link', link: link, chatId: chatId }, { upsert: true });
    return ctx.reply('✅ Group Link အောင်မြင်စွာ သတ်မှတ်ပြီးပါပြီ။');
});

bot.command('startgpdel', async (ctx) => {
    if (ctx.chat.type !== 'private') return;
    if (ctx.from.id !== OWNER_ID) return ctx.reply('❌ Owner သာ အသုံးပြုနိုင်ပါသည်။');
    await Setting.deleteOne({ key: 'group_link' });
    return ctx.reply('🗑 Group Link ကို ဖျက်ပြီးပါပြီ။');
});

bot.command('viwestartgplink', async (ctx) => {
    if (ctx.chat.type !== 'private') return;
    const setting = await Setting.findOne({ key: 'group_link' });
    if (!setting) return ctx.reply('❌ သတ်မှတ်ထားသော Group Link မရှိပါ။');
    return ctx.reply(`🔗 Group Link: ${setting.link}`);
});

bot.command('startlinkChannel', async (ctx) => {
    if (ctx.chat.type !== 'private') return;
    if (ctx.from.id !== OWNER_ID) return ctx.reply('❌ Owner သာ အသုံးပြုနိုင်ပါသည်။');
    const args = ctx.match.split(' ');
    const link = args[0];
    const chatId = args[1] ? Number(args[1]) : null;
    if (!link) return ctx.reply('❌ ပုံစံမမှန်ပါ။ ဥပမာ - /startlinkChannel https://t.me/... -100xxx');
    await Setting.findOneAndUpdate({ key: 'channel_link' }, { key: 'channel_link', type: 'link', link: link, chatId: chatId }, { upsert: true });
    return ctx.reply('✅ Channel Link အောင်မြင်စွာ သတ်မှတ်ပြီးပါပြီ။');
});

bot.command('startchdel', async (ctx) => {
    if (ctx.chat.type !== 'private') return;
    if (ctx.from.id !== OWNER_ID) return ctx.reply('❌ Owner သာ အသုံးပြုနိုင်ပါသည်။');
    await Setting.deleteOne({ key: 'channel_link' });
    return ctx.reply('🗑 Channel Link ကို ဖျက်ပြီးပါပြီ။');
});

bot.command('viwestartchlink', async (ctx) => {
    if (ctx.chat.type !== 'private') return;
    const setting = await Setting.findOne({ key: 'channel_link' });
    if (!setting) return ctx.reply('❌ သတ်မှတ်ထားသော Channel Link မရှိပါ။');
    return ctx.reply(`🔗 Channel Link: ${setting.link}`);
});

bot.command('setMatchGroup', async (ctx) => {
    if (ctx.chat.type !== 'private') return;
    if (ctx.from.id !== OWNER_ID) return ctx.reply('❌ Owner သာ အသုံးပြုနိုင်ပါသည်။');
    const link = ctx.match;
    if (!link) return ctx.reply('❌ ပုံစံမမှန်ပါ။');
    await Setting.findOneAndUpdate({ key: 'match_group_link' }, { key: 'match_group_link', type: 'link', link: link }, { upsert: true });
    return ctx.reply('✅ Match Group Link အောင်မြင်စွာ သတ်မှတ်ပြီးပါပြီ။');
});


// ==========================================
// 2. START & REGISTRATION FLOW
// ==========================================

bot.command('start', async (ctx) => {
    if (ctx.chat.type !== 'private') return;

    const userId = ctx.from.id;
    const userFirstName = ctx.from.first_name || 'သူ';
    const username = ctx.from.username ? `@${ctx.from.username}` : `nofount <a href="https://t.me/Tear808">(@Tear808)</a>`;
    const userBio = ctx.from.bio || '';

    let dbUser = await User.findOne({ telegramId: userId });

    // 📌 အချက်အလက်ဖြည့်ပြီးသူဖြစ်ပါက Group/Channel စစ်မည်။ Join မထားပါက အသုံးပြုခွင့်မပေးပါ
    if (dbUser && dbUser.step === 'COMPLETED') {
        const isSubscribed = await checkUserSubscription(ctx, userId);
        if (!isSubscribed) {
            return ctx.reply(`⚠️ ကျေးဇူးပြု၍ သတ်မှတ်ထားသော Group နှင့် Channel များကို မပျက်မကွက် Join ပေးပါဦးရှင့်။`);
        }
        return ctx.reply(`✨ မင်္ဂလာပါ ${dbUser.name}၊ HeartMatch CUPID မှ ပြန်လည်ကြိုဆိုပါတယ်!`, {
            reply_markup: mainReplyKeyboard
        });
    }

    await User.findOneAndUpdate({ telegramId: userId }, { step: 'IDLE' }, { upsert: true });

    const startMedia = await Setting.findOne({ key: 'start_media' });
    
    // 📌 LOVE Link သတ်မှတ်ခြင်း (HTML Format)
    const love = " @HeartMatch_CUPID_Bot "; 

    const captionText = 
`📮မဂ်လာပါℋℯ𝒶𝓇𝓉ℳ𝒶𝓉𝒸𝒽--ᴄᴜᴘɪᴅ💗မှ
     ကြိုဆိုပါတယ် (<a href="${love}">love</a>)
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

// Check Join နှိပ်သည့်အခါ စစ်ပေးသည့် Logic
bot.callbackQuery('check_join', async (ctx) => {
    const userId = ctx.from.id;
    const isJoined = await checkUserSubscription(ctx, userId);

    if (!isJoined) {
        await ctx.answerCallbackQuery({
            text: "❌ ကျေးဇူးပြု၍ Group နှင့် Channel ကို အရင် Join ပေးပါရှင့်!",
            show_alert: true
        });
        return;
    }

    await ctx.answerCallbackQuery();
    await User.findOneAndUpdate({ telegramId: userId }, { step: 'REG_NAME' });
    await ctx.reply(`⏳အမည်အရင်း(သို့)ကြိုနှစ်သက်ရာအမည်\n       ရေးပီးပို့ပေးပါရှင့် 🗒 \n----ℋℯ𝒶𝓇𝓉ℳ𝒶𝓉𝒸𝒽-----`);
});


// ==========================================
// 3. GROUP /Rs & FORWARD LOGIC
// ==========================================

bot.hears(/^\/Rs/, async (ctx) => {
    if (ctx.chat.type === 'private') return;
    const userId = ctx.from.id;
    try { await ctx.deleteMessage(); } catch (e) {}

    const user = await User.findOne({ telegramId: userId });
    if (!user || !user.likedBy || user.likedBy.length === 0) {
        try { await ctx.api.sendMessage(userId, "❌ သင့်ထံတွင် ချိတ်ဆက်ထားသော Target A/c မရှိသေးပါ။"); } catch (e) {}
        return;
    }

    const targetId = user.likedBy[user.likedBy.length - 1];
    const targetUser = await User.findOne({ telegramId: targetId });

    if (targetUser) {
        const profileCaption = 
`💖 **သင်ဆက်သွယ်ထားသော Match Partner A/c**
------------------------------------
📝 အမည် - ${targetUser.name}
🌿 အသက် - ${targetUser.age} နှစ်
🌷 လိင် - ${targetUser.genderType}
🏡 မြို့နယ် - ${targetUser.locationText}
Bio 🤍: ${targetUser.bio}
------------------------------------`;

        try {
            if (targetUser.photoFileId) {
                await ctx.api.sendPhoto(userId, targetUser.photoFileId, { caption: profileCaption });
            } else {
                await ctx.api.sendMessage(userId, profileCaption);
            }
        } catch (err) {}
    }
});


// ==========================================
// 4. SEARCH, PROFILE & LIKES COUNT LOGIC
// ==========================================

// 📌 ရည်းစား / သူငယ်ချင်း / ဂိမ်းဖော် ရှာဖွေပြသပေးမည့် Logic (Next & Like Count ပါဝင်သည်)
async function searchAndShowCandidate(ctx, mode, excludeIds = []) {
    const userId = ctx.from.id;

    // 📌 Group/Channel မ Join ရသေးပါက လုပ်ဆောင်ခွင့် မပေးပါ
    const isSubscribed = await checkUserSubscription(ctx, userId);
    if (!isSubscribed) {
        return ctx.reply(`⚠️ ကျေးဇူးပြု၍ Group နှင့် Channel ကို အရင် Join ပေးပါရှင့်။`);
    }

    const currentUser = await User.findOne({ telegramId: userId });
    if (!currentUser || currentUser.step !== 'COMPLETED') {
        return ctx.reply(`❌ ကျေးဇူးပြု၍ /start ဖြင့် အချက်အလက် အပြည့်အစုံ ဖြည့်သွင်းပါ။`);
    }

    let targetGender = currentUser.genderType === 'Boy 🤴' ? 'Girl 👸' : 'Boy 🤴';
    
    // မမြင်ဖူးသေးသော တခြား Profile တစ်ခုကို စစ်ထုတ်ခြင်း
    const query = mode === 'dating' 
        ? { telegramId: { $ne: userId, $nin: excludeIds }, genderType: targetGender, step: 'COMPLETED' }
        : { telegramId: { $ne: userId, $nin: excludeIds }, step: 'COMPLETED' };

    const candidate = await User.findOne(query);

    if (!candidate) {
        return ctx.reply(`😔 လက်ရှိတွင် ထပ်မံပြသနိုင်သော Profile မရှိသေးပါ။`, { reply_markup: mainReplyKeyboard });
    }

    const distanceStr = calculateDistance(currentUser.latitude, currentUser.longitude, candidate.latitude, candidate.longitude);
    const modeText = mode === 'dating' ? 'ဖူးစာရှင် (ရည်းစား)' : mode === 'friend' ? 'Just Friend' : 'ဂိမ်းဆော့ဖော်';

    // 📌 စုစုပေါင်း Like နှိပ်ထားသူ ဦးရေ နှင့် Next နှိပ်ထားသူ ဦးရေ စာရင်း
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

    // 📌 ခလုတ်တွင် ဦးရေ အရေအတွက် ပြသပေးခြင်း (ဥပမာ: ❤️ Like (၂၄ ဦး) | ❌ Next (၃၄ ဦး))
    const matchKeyboard = new InlineKeyboard()
        .text(`❤️ Like (${likesArray.length} ဦး)`, `like_${candidate.telegramId}_${mode}`)
        .text(`❌ Next (${nextsArray.length} ဦး)`, `next_${candidate.telegramId}_${mode}`);

    if (candidate.photoFileId) {
        await ctx.replyWithPhoto(candidate.photoFileId, { caption: candidateCaption, parse_mode: 'Markdown', reply_markup: matchKeyboard });
    } else {
        await ctx.reply(candidateCaption, { parse_mode: 'Markdown', reply_markup: matchKeyboard });
    }
}

// 📌 Like နှိပ်သည့် Callback
bot.callbackQuery(/^like_(\d+)_(dating|friend|game)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const targetId = Number(ctx.match[1]);
    const mode = ctx.match[2];
    const senderId = ctx.from.id;

    // 📌 Like စာရင်းထဲ အကောင့် ဝင်စေခြင်း ($addToSet သုံးထား၍ ၁ ခါသာ မှတ်မည်)
    await User.findOneAndUpdate({ telegramId: targetId }, { 
        $addToSet: { likesCount: senderId, likedBy: senderId } 
    });

    const matchGroupSetting = await Setting.findOne({ key: 'match_group_link' });
    const groupLink = matchGroupSetting ? matchGroupSetting.link : 'https://t.me/Tear808';

    const notifyKeyboard = new InlineKeyboard().url('💬 ဆက်သွယ်ရန် Group သို့သွားရန်', groupLink);
    
    try {
        await ctx.api.sendMessage(targetId, `💖 သင့်အား တစ်ယောက်ယောက်မှ Like ပေးထားပါတယ်!\nGroup ထဲတွင် /Rs ပို့ပါ (သို့) ခလုတ်နှိပ်ပါ:`, { reply_markup: notifyKeyboard });
    } catch(e) {}

    await ctx.reply(`⌛ အတည်ပြုပြီးပါပြီ။`, { reply_markup: mainReplyKeyboard });
});

// 📌 Next နှိပ်သည့် Callback (နောက်တစ်ယောက် ဆက်ပြမည့် Logic)
bot.callbackQuery(/^next_(\d+)_(dating|friend|game)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const currentCandidateId = Number(ctx.match[1]);
    const mode = ctx.match[2];
    const senderId = ctx.from.id;

    // Next စာရင်းထဲ ထည့်သွင်းခြင်း ($addToSet သုံးထား၍ ၁ ခါသာ မှတ်မည်)
    await User.findOneAndUpdate({ telegramId: currentCandidateId }, { 
        $addToSet: { nextsCount: senderId } 
    });

    // အဟောင်းကို ကျော်ပြီး နောက်တစ်ယောက် ပြသပေးခြင်း
    await searchAndShowCandidate(ctx, mode, [currentCandidateId]);
});

bot.hears('💘 ရည်းစားရှာမယ်', async (ctx) => {
    if (ctx.chat.type !== 'private') return;
    await searchAndShowCandidate(ctx, 'dating');
});

bot.hears('🤝 Just Friend ရှာမယ်', async (ctx) => {
    if (ctx.chat.type !== 'private') return;
    await searchAndShowCandidate(ctx, 'friend');
});

bot.hears('🎮 ဂိမ်းဆော့ဖော်ရှာမယ်', async (ctx) => {
    if (ctx.chat.type !== 'private') return;
    await searchAndShowCandidate(ctx, 'game');
});

bot.hears('👤 မိမိ Profile', async (ctx) => {
    if (ctx.chat.type !== 'private') return;
    const userId = ctx.from.id;

    const isSubscribed = await checkUserSubscription(ctx, userId);
    if (!isSubscribed) return ctx.reply(`⚠️ ကျေးဇူးပြု၍ Group နှင့် Channel ကို အရင် Join ပေးပါရှင့်။`);

    const user = await User.findOne({ telegramId: userId });
    if (!user || user.step !== 'COMPLETED') return ctx.reply(`❌ မှတ်ပုံတင်ခြင်း မပြီးသေးပါ။ /start ဖြင့် စတင်ပါ။`);

    const profileText = 
`👤 **သင့်၏ ကိုယ်ရေးအချက်အလက် (Profile)**
------------------------------------
📝 အမည် - ${user.name}
🌿 အသက် - ${user.age} နှစ်
🌷 လိင် - ${user.genderType}
🏡 မြို့နယ် - ${user.locationText}
🤍 Bio - ${user.bio}
------------------------------------`;

    if (user.photoFileId) {
        await ctx.replyWithPhoto(user.photoFileId, { caption: profileText, parse_mode: 'Markdown', reply_markup: mainReplyKeyboard });
    } else {
        await ctx.reply(profileText, { parse_mode: 'Markdown', reply_markup: mainReplyKeyboard });
    }
});

bot.hears('💌 ငါ့ကိုသဘောကျသူများ', async (ctx) => {
    if (ctx.chat.type !== 'private') return;
    const userId = ctx.from.id;

    const isSubscribed = await checkUserSubscription(ctx, userId);
    if (!isSubscribed) return ctx.reply(`⚠️ ကျေးဇူးပြု၍ Group နှင့် Channel ကို အရင် Join ပေးပါရှင့်။`);

    const user = await User.findOne({ telegramId: userId });

    if (!user || !user.likedBy || user.likedBy.length === 0) {
        return ctx.reply(`📭 လက်ရှိတွင် သင့်ကို Like ပေးထားသူ မရှိသေးပါ။`, { reply_markup: mainReplyKeyboard });
    }

    const likerId = user.likedBy[0];
    const likerUser = await User.findOne({ telegramId: likerId });

    if (!likerUser) {
        return ctx.reply(`📭 သင့်ကို Like ပေးထားသူ မရှိတော့ပါ။`, { reply_markup: mainReplyKeyboard });
    }

    const distanceStr = calculateDistance(user.latitude, user.longitude, likerUser.latitude, likerUser.longitude);

    const likerCaption = 
`💌 **သင့်ကို သဘောကျ/Like ပေးထားသူ**
------------------------------------
အမည် - ❤️ ${likerUser.name}
အသက် - ${likerUser.age} နှစ်
လိင် - ${likerUser.genderType}
မြို့နယ် - ${likerUser.locationText}
Bio - ${likerUser.bio}
🟡 အကွာအဝေး - ${distanceStr} km
------------------------------------`;

    const likeKeyboard = new InlineKeyboard()
        .text('❤️ Like ပြန်လုပ်မည်', `back_like_${likerUser.telegramId}`)
        .text('❌ ကျော်မည် (Next)', `skip_liked`);

    if (likerUser.photoFileId) {
        await ctx.replyWithPhoto(likerUser.photoFileId, { caption: likerCaption, parse_mode: 'Markdown', reply_markup: likeKeyboard });
    } else {
        await ctx.reply(likerCaption, { parse_mode: 'Markdown', reply_markup: likeKeyboard });
    }
});

bot.callbackQuery('skip_liked', async (ctx) => {
    await ctx.answerCallbackQuery();
    const userId = ctx.from.id;
    await User.findOneAndUpdate({ telegramId: userId }, { $pop: { likedBy: -1 } });
    await ctx.reply(`⏭ နောက်တစ်ယောက်ဆီသို့... ("💌 ငါ့ကိုသဘောကျသူများ" ကို ထပ်နှိပ်ပါ)`);
});

bot.on(':location', async (ctx) => {
    if (ctx.chat.type !== 'private') return;
    const lat = ctx.message.location.latitude;
    const lon = ctx.message.location.longitude;
    await User.findOneAndUpdate({ telegramId: ctx.from.id }, { latitude: lat, longitude: lon });
    await ctx.reply(`📍 သင်၏ တည်နေရာကို မှတ်သားပြီးပါပြီ။`, { reply_markup: mainReplyKeyboard });
});


// ==========================================
// 5. PROFILE EDIT & REGISTRATION LOGIC
// ==========================================

bot.hears('⚙️ ကိုယ်ရေးအချက်အလက် ပြင်ရန်', async (ctx) => {
    if (ctx.chat.type !== 'private') return;
    const userId = ctx.from.id;

    const isSubscribed = await checkUserSubscription(ctx, userId);
    if (!isSubscribed) return ctx.reply(`⚠️ ကျေးဇူးပြု၍ Group နှင့် Channel ကို အရင် Join ပေးပါရှင့်။`);

    const user = await User.findOne({ telegramId: userId });
    if (!user || user.step !== 'COMPLETED') return ctx.reply(`❌ မှတ်ပုံတင်ခြင်း မပြီးသေးပါ။`);

    const editKeyboard = new InlineKeyboard()
        .text('✏️ အမည်ပြင်မယ်', 'edit_name').text('✏️ အသက်ပြင်မယ်', 'edit_age').row()
        .text('✏️ လိင်ပြင်မယ်', 'edit_gender').text('✏️ ပုံပြင်မယ်', 'edit_photo').row()
        .text('✏️ မြို့နယ်ပြင်မယ်', 'edit_location').text('✏️ Bio ပြင်မယ်', 'edit_bio');

    await ctx.reply(`⚙️ ပြင်ဆင်လိုသည့် အချက်အလက်ကို ရွေးချယ်ပါ -`, { reply_markup: editKeyboard });
});

bot.callbackQuery('edit_name', async (ctx) => { await ctx.answerCallbackQuery(); await User.findOneAndUpdate({ telegramId: ctx.from.id }, { step: 'EDIT_NAME' }); await ctx.reply(`📝 အမည်သစ် ပို့ပေးပါ -`); });
bot.callbackQuery('edit_age', async (ctx) => { await ctx.answerCallbackQuery(); await User.findOneAndUpdate({ telegramId: ctx.from.id }, { step: 'EDIT_AGE' }); await ctx.reply(`🌿 အသက်သစ် ပို့ပေးပါ -`); });
bot.callbackQuery('edit_gender', async (ctx) => { await ctx.answerCallbackQuery(); await User.findOneAndUpdate({ telegramId: ctx.from.id }, { step: 'EDIT_GENDER' }); await ctx.reply(`⏳ လိင်အမျိုးအစားသစ် (1=Boy, 2=Girl, 3=Lgpt) -`); });
bot.callbackQuery('edit_photo', async (ctx) => { await ctx.answerCallbackQuery(); await User.findOneAndUpdate({ telegramId: ctx.from.id }, { step: 'EDIT_PHOTO' }); await ctx.reply(`🌻 ပုံအသစ် ပို့ပေးပါ -`); });
bot.callbackQuery('edit_location', async (ctx) => { await ctx.answerCallbackQuery(); await User.findOneAndUpdate({ telegramId: ctx.from.id }, { step: 'EDIT_LOCATION' }); await ctx.reply(`🏡 မြို့နယ်အသစ် ပို့ပေးပါ -`); });
bot.callbackQuery('edit_bio', async (ctx) => { await ctx.answerCallbackQuery(); await User.findOneAndUpdate({ telegramId: ctx.from.id }, { step: 'EDIT_BIO' }); await ctx.reply(`🤍 Bio အသစ် ပို့ပေးပါ -`); });

bot.on('message', async (ctx) => {
    if (ctx.chat.type !== 'private') return;
    const userId = ctx.from.id;
    let dbUser = await User.findOne({ telegramId: userId });
    if (!dbUser) return;

    if (dbUser.step === 'REG_NAME') {
        dbUser.name = ctx.message.text;
        dbUser.step = 'REG_AGE';
        await dbUser.save();
        return ctx.reply(`⏳ သင့်အသက်ကိုရေးပေးပါရှင့်\n         🌿"----ℋℯ𝒶𝓇ᵗℳ𝒶𝓉𝒸𝒽-----"`);
    }
    else if (dbUser.step === 'REG_AGE') {
        dbUser.age = ctx.message.text;
        dbUser.step = 'REG_GENDER';
        await dbUser.save();
        return ctx.reply(`⏳သင့်အမျိုးအစားကိုရေးပေးပါရှင့်\n1=Boy🤴, 2=Girl👸, 3=Lgpt🌈`);
    }
    else if (dbUser.step === 'REG_GENDER') {
        let val = ctx.message.text;
        dbUser.genderType = val === '1' ? 'Boy 🤴' : val === '2' ? 'Girl 👸' : 'Lgpt 🌈';
        dbUser.step = 'REG_PHOTO';
        await dbUser.save();
        return ctx.reply(`⏳သင့်photo(1) ပုံလောက်ပို့ပေးပါရှင့်`);
    }
    else if (dbUser.step === 'REG_PHOTO') {
        if (!ctx.message.photo) return ctx.reply('❌ ကျေးဇူးပြု၍ ဓာတ်ပုံ ပို့ပေးပါ။');
        dbUser.photoFileId = ctx.message.photo[ctx.message.photo.length - 1].file_id;
        dbUser.step = 'REG_LOCATION';
        await dbUser.save();
        return ctx.reply(`⏳သင့်နေထိုင်ရာမြို့နယ်တိုင်းဒေသကြီးကိုရေးပေးပါရှင့်။`);
    }
    else if (dbUser.step === 'REG_LOCATION') {
        dbUser.locationText = ctx.message.text;
        dbUser.step = 'REG_BIO';
        await dbUser.save();
        return ctx.reply(`⏳သင့်ရဲ့အကြောင်းအရာကိုအနည်းငယ်လောက် ရေးပေးပါရှင့်`);
    }
    else if (dbUser.step === 'REG_BIO') {
        dbUser.bio = ctx.message.text;
        dbUser.step = 'COMPLETED';
        await dbUser.save();
        return ctx.reply(`⌛အတည်ပြူပီပါပီ ℋℯ𝒶𝓇𝓉ℳ𝒶𝓉𝒸𝒽မှ ကြိုဆိုပါတယ်💌`, { reply_markup: mainReplyKeyboard });
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

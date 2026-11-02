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

// 📌 Chat box အောက်ဆုံးတွင် အမြဲပေါ်နေမည့် Reply Keyboard
const mainReplyKeyboard = new Keyboard()
    .requestLocation('📍 တည်နေရာပေးပို့မည်').row()
    .text('💘 ရည်းစားရှာမယ်').text('🤝 Just Friend ရှာမယ်').row()
    .text('🎮 ဂိမ်းဆော့ဖော်ရှာမယ်').text('💌 ငါ့ကိုသဘောကျသူများ').row()
    .text('⚙️ ကိုယ်ရေးအချက်အလက် ပြင်ရန်')
    .resized()
    .persistent();


// ==========================================
// 1. OWNER COMMANDS (Media & Links Management)
// ==========================================

bot.command('HeartMatchstartinfo', async (ctx) => {
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
    const setting = await Setting.findOne({ key: 'start_media' });
    if (!setting) return ctx.reply('❌ သတ်မှတ်ထားသော Start Media မရှိပါ။');
    if (setting.type === 'photo') await ctx.replyWithPhoto(setting.fileId);
    else await ctx.replyWithVideo(setting.fileId);
});

bot.command('Delstartheart', async (ctx) => {
    if (ctx.from.id !== OWNER_ID) return ctx.reply('❌ Owner သာ အသုံးပြုနိုင်ပါသည်။');
    await Setting.deleteOne({ key: 'start_media' });
    return ctx.reply('🗑 Start Media ကို ဖျက်ပြီးပါပြီ။');
});

bot.command('startlinkGroup', async (ctx) => {
    if (ctx.from.id !== OWNER_ID) return ctx.reply('❌ Owner သာ အသုံးပြုနိုင်ပါသည်။');
    const link = ctx.match;
    if (!link) return ctx.reply('❌ ပုံစံမမှန်ပါ။ ဥပမာ - /startlinkGroup https://t.me/...');
    await Setting.findOneAndUpdate({ key: 'group_link' }, { key: 'group_link', type: 'link', link: link }, { upsert: true });
    return ctx.reply('✅ Group Link အောင်မြင်စွာ သတ်မှတ်ပြီးပါပြီ။');
});

bot.command('startgpdel', async (ctx) => {
    if (ctx.from.id !== OWNER_ID) return ctx.reply('❌ Owner သာ အသုံးပြုနိုင်ပါသည်။');
    await Setting.deleteOne({ key: 'group_link' });
    return ctx.reply('🗑 Group Link ကို ဖျက်ပြီးပါပြီ။');
});

bot.command('viwestartgplink', async (ctx) => {
    const setting = await Setting.findOne({ key: 'group_link' });
    if (!setting) return ctx.reply('❌ သတ်မှတ်ထားသော Group Link မရှိပါ။');
    return ctx.reply(`🔗 Group Link: ${setting.link}`);
});

bot.command('startlinkChannel', async (ctx) => {
    if (ctx.from.id !== OWNER_ID) return ctx.reply('❌ Owner သာ အသုံးပြုနိုင်ပါသည်။');
    const link = ctx.match;
    if (!link) return ctx.reply('❌ ပုံစံမမှန်ပါ။ ဥပမာ - /startlinkChannel https://t.me/...');
    await Setting.findOneAndUpdate({ key: 'channel_link' }, { key: 'channel_link', type: 'link', link: link }, { upsert: true });
    return ctx.reply('✅ Channel Link အောင်မြင်စွာ သတ်မှတ်ပြီးပါပြီ။');
});

bot.command('startchdel', async (ctx) => {
    if (ctx.from.id !== OWNER_ID) return ctx.reply('❌ Owner သာ အသုံးပြုနိုင်ပါသည်။');
    await Setting.deleteOne({ key: 'channel_link' });
    return ctx.reply('🗑 Channel Link ကို ဖျက်ပြီးပါပြီ။');
});

bot.command('viwestartchlink', async (ctx) => {
    const setting = await Setting.findOne({ key: 'channel_link' });
    if (!setting) return ctx.reply('❌ သတ်မှတ်ထားသော Channel Link မရှိပါ။');
    return ctx.reply(`🔗 Channel Link: ${setting.link}`);
});

bot.command('setMatchGroup', async (ctx) => {
    if (ctx.from.id !== OWNER_ID) return ctx.reply('❌ Owner သာ အသုံးပြုနိုင်ပါသည်။');
    const link = ctx.match;
    if (!link) return ctx.reply('❌ ပုံစံမမှန်ပါ။ ဥပမာ - /setMatchGroup https://t.me/...');
    await Setting.findOneAndUpdate({ key: 'match_group_link' }, { key: 'match_group_link', type: 'link', link: link }, { upsert: true });
    return ctx.reply('✅ Match Group Link အောင်မြင်စွာ သတ်မှတ်ပြီးပါပြီ။');
});


// ==========================================
// 2. START & REGISTRATION FLOW
// ==========================================

bot.command('start', async (ctx) => {
    const userId = ctx.from.id;
    const userFirstName = ctx.from.first_name || 'သူ';
    const username = ctx.from.username ? `@${ctx.from.username}` : `nofount <a href="https://t.me/Tear808">(@Tear808)</a>`;
    const userBio = ctx.from.bio || '';

    await User.findOneAndUpdate({ telegramId: userId }, { step: 'IDLE' }, { upsert: true });

    const startMedia = await Setting.findOne({ key: 'start_media' });
    const captionText = 
`📮မဂ်လာပါℋℯ𝒶𝓇𝓉ℳ𝒶𝓉𝒸𝒽--ᴄᴜᴘɪᴅ💗မှ
     ကြိုဆိုပါတယ် <a href="https://t.me/HeartMatch_CUPID_Bot">LOVE</a> ဆိုတဲစာကို ကွင်းထဲမှာအပြာနဲရေးပေးအတာနိပ်ရင် @HeartMatch_CUPID_Bot pfရောက်ချိပ်ပေး
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
    await ctx.answerCallbackQuery();
    await ctx.reply("လူကြီးမင်းကိုစစ်ဆေးပေးနေပါတယ်ရှင့်⏳\n(Please....... HeartMatch)");

    const isJoined = true;
    if (!isJoined) {
        await ctx.reply("Sorry:-You can see join?\n[မjoinထားရင်မရပါ❌]");
        return;
    }

    await User.findOneAndUpdate({ telegramId: ctx.from.id }, { step: 'REG_NAME' });
    await ctx.reply(`⏳အမည်အရင်း(သို့)ကြိုနှစ်သက်ရာအမည်\n       ရေးပီးပို့ပေးပါရှင့် 🗒 \n----ℋℯ𝒶𝓇𝓉ℳ𝒶𝓉𝒸𝒽-----`);
});


// ==========================================
// 3. LOCATION & SEARCH FEATURES
// ==========================================

bot.on(':location', async (ctx) => {
    const lat = ctx.message.location.latitude;
    const lon = ctx.message.location.longitude;
    await User.findOneAndUpdate({ telegramId: ctx.from.id }, { latitude: lat, longitude: lon });
    await ctx.reply(`📍 သင်၏ တည်နေရာကို အောင်မြင်စွာ မှတ်သားပြီးပါပြီ။`, { reply_markup: mainReplyKeyboard });
});

bot.hears('💘 ရည်းစားရှာမယ်', async (ctx) => {
    await searchAndShowCandidate(ctx, 'dating');
});

bot.hears('🤝 Just Friend ရှာမယ်', async (ctx) => {
    await searchAndShowCandidate(ctx, 'friend');
});

bot.hears('🎮 ဂိမ်းဆော့ဖော်ရှာမယ်', async (ctx) => {
    await searchAndShowCandidate(ctx, 'game');
});

async function searchAndShowCandidate(ctx, mode) {
    const userId = ctx.from.id;
    const currentUser = await User.findOne({ telegramId: userId });
    if (!currentUser || currentUser.step !== 'COMPLETED') {
        return ctx.reply(`❌ ကျေးဇူးပြု၍ /start ဖြင့် အချက်အလက် အပြည့်အစုံ ဖြည့်သွင်းပါ။`);
    }

    let targetGender = currentUser.genderType === 'Boy 🤴' ? 'Girl 👸' : 'Boy 🤴';
    const query = mode === 'dating' 
        ? { telegramId: { $ne: userId }, genderType: targetGender, step: 'COMPLETED' }
        : { telegramId: { $ne: userId }, step: 'COMPLETED' };

    const candidate = await User.findOne(query);

    if (!candidate) {
        return ctx.reply(`😔 လက်ရှိတွင် ရှာဖွေတွေ့ရှိနိုင်သော Profile မရှိသေးပါ။`);
    }

    const distanceStr = calculateDistance(currentUser.latitude, currentUser.longitude, candidate.latitude, candidate.longitude);
    const modeText = mode === 'dating' ? 'ဖူးစာရှင် (ရည်းစား)' : mode === 'friend' ? 'Just Friend' : 'ဂိမ်းဆော့ဖော်';

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
        .text('❤️ Like', `like_${candidate.telegramId}_${mode}`)
        .text('❌ Next', `next_${mode}`);

    if (candidate.photoFileId) {
        await ctx.replyWithPhoto(candidate.photoFileId, { caption: candidateCaption, parse_mode: 'Markdown', reply_markup: matchKeyboard });
    } else {
        await ctx.reply(candidateCaption, { parse_mode: 'Markdown', reply_markup: matchKeyboard });
    }
}

bot.callbackQuery(/^like_(\d+)_(dating|friend|game)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const targetId = Number(ctx.match[1]);
    const matchGroupSetting = await Setting.findOne({ key: 'match_group_link' });
    const groupLink = matchGroupSetting ? matchGroupSetting.link : 'https://t.me/Tear808';

    const notifyKeyboard = new InlineKeyboard().url('💬 ဆက်သွယ်ရန် Group သို့သွားရန်', groupLink);

    await ctx.api.sendMessage(
        targetId,
        `💖 သင့်အား တစ်ယောက်ယောက်မှ Like ပေးထားပါတယ်!\n\nGroup ထဲတွင် စာပို့ရန် /Rs ကို အသုံးပြုပါ သို့မဟုတ် အောက်ပါခလုတ်ကို နှိပ်ပါ[cite: 2]:`,
        { reply_markup: notifyKeyboard }
    );

    await ctx.reply(`⌛ အတည်ပြုပြီးပါပြီ။ ချိတ်ဆက်မှု အောင်မြင်ပါသည် 💌🇲🇲`, { reply_markup: mainReplyKeyboard });
});

bot.callbackQuery(/^next_(dating|friend|game)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.reply(`⏭ နောက်တစ်ယောက်ဆီသို့ ရွှေ့နေပါပြီ...`);
});


// ==========================================
// 4. REGISTRATION & PROFILE EDIT (MESSAGE HANDLER)
// ==========================================

bot.hears('⚙️ ကိုယ်ရေးအချက်အလက် ပြင်ရန်', async (ctx) => {
    const user = await User.findOne({ telegramId: ctx.from.id });
    if (!user || user.step !== 'COMPLETED') {
        return ctx.reply(`❌ မှတ်ပုံတင်ခြင်း မပြီးသေးပါ။ /start ဖြင့် စတင်ပါ။`);
    }

    const editKeyboard = new InlineKeyboard()
        .text('✏️ အမည်ပြင်မယ်', 'edit_name')
        .text('✏️ အသက်ပြင်မယ်', 'edit_age').row()
        .text('✏️ ပုံသစ်တင်မယ်', 'edit_photo')
        .text('✏️ မြို့နယ်ပြင်မယ်', 'edit_location').row()
        .text('✏️ Bio ပြင်မယ်', 'edit_bio');

    await ctx.reply(`⚙️ ပြင်ဆင်လိုသည့် အချက်အလက်ကို ရွေးချယ်ပါ -`, { reply_markup: editKeyboard });
});

bot.callbackQuery('edit_name', async (ctx) => {
    await ctx.answerCallbackQuery();
    await User.findOneAndUpdate({ telegramId: ctx.from.id }, { step: 'EDIT_NAME' });
    await ctx.reply(`📝 အမည်သစ်ကို ရေးသားပေးပို့ပါရှင့် -`);
});

bot.callbackQuery('edit_age', async (ctx) => {
    await ctx.answerCallbackQuery();
    await User.findOneAndUpdate({ telegramId: ctx.from.id }, { step: 'EDIT_AGE' });
    await ctx.reply(`🌿 အသက်အသစ်ကို ရေးသားပေးပို့ပါရှင့် -`);
});

bot.callbackQuery('edit_photo', async (ctx) => {
    await ctx.answerCallbackQuery();
    await User.findOneAndUpdate({ telegramId: ctx.from.id }, { step: 'EDIT_PHOTO' });
    await ctx.reply(`🌻 ပုံအသစ် (၁) ပုံ ပို့ပေးပါရှင့် -`);
});

bot.callbackQuery('edit_location', async (ctx) => {
    await ctx.answerCallbackQuery();
    await User.findOneAndUpdate({ telegramId: ctx.from.id }, { step: 'EDIT_LOCATION' });
    await ctx.reply(`🏡 မြို့နယ်အသစ်ကို ရေးသားပေးပို့ပါရှင့် -`);
});

bot.callbackQuery('edit_bio', async (ctx) => {
    await ctx.answerCallbackQuery();
    await User.findOneAndUpdate({ telegramId: ctx.from.id }, { step: 'EDIT_BIO' });
    await ctx.reply(`🤍 Bio အသစ်ကို ရေးသားပေးပို့ပါရှင့် -`);
});

bot.on('message', async (ctx) => {
    const userId = ctx.from.id;
    let dbUser = await User.findOne({ telegramId: userId });
    if (!dbUser) return;

    // --- REGISTRATION STEPS ---
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
        return ctx.reply(
            `⏳သင့်အမျိုးအစားကိုရေးပေးပါရှင့်\n` +
            `      ဉပမာ- 1=Boy🤴 \n` +
            `                   2=Girl👸\n` +
            `                   3=Lgpt🌈   \n` +
            `  🌷ရေးသားရန် boyဆိုပါက 1လို့ရေးပို့ပေးပါ။\n` +
            `     🌷ရေးသားရန် girlဆိုပါက 2လို့ရေးပို့ပေးပါ။\n` +
            `          🌷ရေးသားရန် Lgptဆိုပါက 3လို့ရေးပို့ပေးပါ။\n` +
            `:🍃----ℋℯ𝒶𝓇𝓉ℳ𝒶𝓉𝒸𝒽-----`
        );
    }
    else if (dbUser.step === 'REG_GENDER') {
        let val = ctx.message.text;
        dbUser.genderType = val === '1' ? 'Boy 🤴' : val === '2' ? 'Girl 👸' : 'Lgpt 🌈';
        dbUser.step = 'REG_PHOTO';
        await dbUser.save();
        return ctx.reply(`⏳သင့်photo(1) ပုံလောက်ပို့ပေးပါရှင့်\n    :-🌻---ℋℯ𝒶𝓇𝓉ℳ𝒶𝓉𝒸𝒽----`);
    }
    else if (dbUser.step === 'REG_PHOTO') {
        if (!ctx.message.photo) return ctx.reply('❌ ကျေးဇူးပြု၍ ပုံ (၁) ပုံ ပို့ပေးပါ။');
        dbUser.photoFileId = ctx.message.photo[ctx.message.photo.length - 1].file_id;
        dbUser.step = 'REG_LOCATION';
        await dbUser.save();
        return ctx.reply(`⏳သင့်နေထိုင်ရာမြို့နယ်တိုင်းဒေသကြီးကိုရေးပေး        ပါရှင့်။":--🗒--ℋℯ𝒶𝓇𝓉ℳ𝒶𝓉𝒸𝒽---"`);
    }
    else if (dbUser.step === 'REG_LOCATION') {
        dbUser.locationText = ctx.message.text;
        dbUser.step = 'REG_BIO';
        await dbUser.save();
        return ctx.reply(`⏳သင့်ရဲ့အကြောင်းအရာကိုအနည်းငယ်လောက်\n      ရေးပေးပါရှင့်":---🤍--ℋℯ𝒶𝓇𝓉ℳ𝒶𝓉𝒸𝒽---"`);
    }
    else if (dbUser.step === 'REG_BIO') {
        dbUser.bio = ctx.message.text;
        dbUser.step = 'COMPLETED';
        await dbUser.save();
        
        await ctx.reply(`⌛အတည်ပြူပီပါပီ "ℋℯ𝒶𝓇𝓉ℳ𝒶𝓉𝒸𝒽မှနွေးထွေးစွာ\n        ကြိုဆိုပါတယ်💌🇲🇲"`, { reply_markup: mainReplyKeyboard });
        
        const summary = 
`👤 **Match Profile**
------------------------------------
အမည် 📝: ${dbUser.name}
အသက် 🌿: ${dbUser.age}
လိင် 🌷: ${dbUser.genderType}
မြို့နယ် 🏡: ${dbUser.locationText}
Bio 🤍: ${dbUser.bio}
------------------------------------`;
        await ctx.replyWithPhoto(dbUser.photoFileId, { caption: summary, parse_mode: 'Markdown' });
    }

    // --- EDIT STEPS ---
    else if (dbUser.step === 'EDIT_NAME') {
        dbUser.name = ctx.message.text;
        dbUser.step = 'COMPLETED';
        await dbUser.save();
        return ctx.reply(`✅ အမည်ကို အောင်မြင်စွာ ပြင်ဆင်ပြီးပါပြီ။`, { reply_markup: mainReplyKeyboard });
    }
    else if (dbUser.step === 'EDIT_AGE') {
        dbUser.age = ctx.message.text;
        dbUser.step = 'COMPLETED';
        await dbUser.save();
        return ctx.reply(`✅ အသက်ကို အောင်မြင်စွာ ပြင်ဆင်ပြီးပါပြီ။`, { reply_markup: mainReplyKeyboard });
    }
    else if (dbUser.step === 'EDIT_PHOTO') {
        if (!ctx.message.photo) return ctx.reply('❌ ကျေးဇူးပြု၍ ပုံ (၁) ပုံ ပို့ပေးပါ။');
        dbUser.photoFileId = ctx.message.photo[ctx.message.photo.length - 1].file_id;
        dbUser.step = 'COMPLETED';
        await dbUser.save();
        return ctx.reply(`✅ ပုံကို အောင်မြင်စွာ ပြင်ဆင်ပြီးပါပြီ။`, { reply_markup: mainReplyKeyboard });
    }
    else if (dbUser.step === 'EDIT_LOCATION') {
        dbUser.locationText = ctx.message.text;
        dbUser.step = 'COMPLETED';
        await dbUser.save();
        return ctx.reply(`✅ မြို့နယ်ကို အောင်မြင်စွာ ပြင်ဆင်ပြီးပါပြီ။`, { reply_markup: mainReplyKeyboard });
    }
    else if (dbUser.step === 'EDIT_BIO') {
        dbUser.bio = ctx.message.text;
        dbUser.step = 'COMPLETED';
        await dbUser.save();
        return ctx.reply(`✅ Bio ကို အောင်မြင်စွာ ပြင်ဆင်ပြီးပါပြီ။`, { reply_markup: mainReplyKeyboard });
    }
});

bot.start();

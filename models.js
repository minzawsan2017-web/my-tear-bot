const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    telegramId: { type: Number, required: true, unique: true },
    name: { type: String },
    age: { type: String },
    genderType: { type: String },
    photoFileId: { type: String },
    locationText: { type: String },
    latitude: { type: Number },
    longitude: { type: Number },
    bio: { type: String },
    step: { type: String, default: 'IDLE' },
    likedBy: [{ type: Number }], // မိမိကို Like ပေးထားသူများ
    myLikes: [{ type: Number }], // မိမိမှ Like ပေးခဲ့သူများ
    chatTarget: { type: Number, default: null }, // လက်ရှိ စာပို့နေသူ၏ ID
    msgCount: { type: Number, default: 0 },
    acceptedChats: [{ type: Number }],
    blockedChats: [{ type: Number }],
    likesCount: [{ type: Number }],
    nextsCount: [{ type: Number }]
});
const User = mongoose.model('HeartMatchUser', userSchema);

const settingSchema = new mongoose.Schema({
    key: { type: String, required: true, unique: true },
    type: { type: String },
    fileId: { type: String },
    link: { type: String },
    chatId: { type: Number }
});
const Setting = mongoose.model('HeartMatchSetting', settingSchema);

module.exports = { User, Setting };

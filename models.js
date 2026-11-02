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
    likedBy: [{ type: Number }], // မိမိကို Like ထားသူများ၏ ID များ
    likesCount: [{ type: Number }], // မိမိ Profile ကို Like နှိပ်ဖူးသူများ (Unique Users)
    nextsCount: [{ type: Number }]  // မိမိ Profile ကို Next နှိပ်ဖူးသူများ (Unique Users)
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

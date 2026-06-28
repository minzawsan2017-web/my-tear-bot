import os
import json
import asyncio
import aiohttp
import base64
import sys
from datetime import datetime, timedelta
from dotenv import load_dotenv
from aiohttp import web
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup, ChatPermissions
from telegram.ext import (Application, CommandHandler, MessageHandler, 
                          filters, ChatMemberHandler, ContextTypes, CallbackQueryHandler)

# Config Setup
load_dotenv()
BOT_TOKEN = os.getenv("BOT_TOKEN")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

if not BOT_TOKEN:
    print("❌ ERROR: 'BOT_TOKEN' is missing in Environment Variables!", file=sys.stderr)
    sys.exit(1)

ADMIN_IDS = [8533383380, 7771663458]
CHANNEL_ID = -1003841480184  

DATA_FILE = "ai_bot_data.json"
REPLY_FILE = "custom_replies.json"
PREMIUM_FILE = "premium_users.json"

def load_db(f): 
    if os.path.exists(f):
        try:
            with open(f, 'r', encoding='utf-8') as file:
                return json.load(file)
        except:
            return {}
    else:
        with open(f, 'w', encoding='utf-8') as file:
            file.write("{}")
        return {}

def save_db(f, d): 
    with open(f, 'w', encoding='utf-8') as file:
        json.dump(d, file, indent=2, ensure_ascii=False)

groups, replies = load_db(DATA_FILE), load_db(REPLY_FILE)
premium_users = load_db(PREMIUM_FILE)

# --- Web Server Handler ---
async def handle_web_request(request):
    return web.Response(text="👧 AI Girl Bot is Alive and Running Smoothly!")

def is_premium_user(user_id):
    uid_str = str(user_id)
    if int(user_id) in ADMIN_IDS: return True
    if uid_str in premium_users:
        exp_date_str = premium_users[uid_str].get("expire_date")
        if exp_date_str:
            try:
                exp_date = datetime.strptime(exp_date_str, "%Y-%m-%d %H:%M:%S")
                if datetime.now() < exp_date:
                    return True
                else:
                    del premium_users[uid_str]
                    save_db(PREMIUM_FILE, premium_users)
            except:
                return False
    return False

PREMIUM_INFO_TEXT = (
    "💎 *AI Bot Premium Plan ဝယ်ယူရန် အချက်အလက်များ* 💎\n\n"
    "Premium ဝယ်ယူထားသူများသည် Bot ရှိသော *Group အားလုံးတွင်*\n"
    "🎨 AI ပုံထုတ်ခြင်း (အကန့်အသတ်မရှိ)\n"
    "🎵 AI သီချင်းဆိုခိုင်းခြင်း\n"
    "💻 AI ကုဒ်ရေးခိုင်းခြင်းများကို စိုက်ကြိုက် အသုံးပြုနိုင်ပါပြီရှင်! ✨\n\n"
    "💵 *ဈေးနှုန်း:* တစ်လစာ - 5000 Kyats\n"
    "⚠️ *မှတ်ချက်:* _ဝယ်ယူပြီးပါက ပိုက်ဆံပြန်မအမ်းပါရှင်။_\n\n"
    "💳 *ငွေပေးချေရန် နည်းလမ်းများ:*\n"
    "• Wave Money / KBZPay\n"
    "• Name: *THUZARNWE*\n"
    "• Phone: `09-9970048375`\n"
    "⚠️ _(ဖုန်းနံပါတ်နှင့် နာမည် မတူလျှင် လုံးဝ အလိမ်ပါရှင့်။)_\n\n"
    "📩 *ဝယ်ယူပြီးနောက် လိုက်နာရန်:*\n"
    "ငွေလွှဲထားတဲ့စာကို **Screenshot (SS)** ရိုက်ပြီး အောက်ပါ Admin ထံသို့ ပို့ပေးပါနော်။ "
    "Admin က အတည်ပြုလိုက်ရင် သူစတင်အသုံးပြုလို့ရပါပြီရှင်। 🥰\n\n"
    "👨‍💻 *ဆက်သွယ်ရန် Admin:* @Tear808"
)

def get_main_kb(bot_username):
    return InlineKeyboardMarkup([
        [InlineKeyboardButton("📢 Channel", url="https://t.me/BOTUAPTE")],
        [InlineKeyboardButton("👥 Group", url="https://t.me/+XukiNeB77qw2M2I9")],
        [InlineKeyboardButton("💎 Premium ဝယ်ယူရန်", callback_data="show_premium")],
        [InlineKeyboardButton("➕ Group ထဲသို့ထည့်ရန်", url=f"https://t.me/{bot_username}?startgroup=true")]
    ])

# --- AI Engines ---
async def get_ai(msg):
    if not GEMINI_API_KEY: return "⚠️ Gemini API Key စနစ်ကို Setup မလုပ်ရသေးပါဘူးရှင်။"
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={GEMINI_API_KEY}"
    try:
        async with aiohttp.ClientSession() as s:
            async with s.post(url, json={"contents": [{"parts": [{"text": msg}]}]}) as r:
                res = await r.json()
                return res["candidates"][0]["content"]["parts"][0]["text"]
    except: return "🤖 AI စနစ် ခဏနားနေပါတယ်ရှင်။ API Key ကို စစ်ဆေးပေးပါဦး။"

async def generate_ai_image(prompt):
    if not GEMINI_API_KEY: return None
    url = f"https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:generateImages?key={GEMINI_API_KEY}"
    payload = {"prompt": prompt, "numberOfImages": 1, "outputMimeType": "image/jpeg", "aspectRatio": "1:1"}
    try:
        async with aiohttp.ClientSession() as s:
            async with s.post(url, json=payload) as r:
                res = await r.json()
                img_base64 = res["generatedImages"][0]["image"]["imageBytes"]
                return base64.b64decode(img_base64)
    except: return None

# --- Basic Handlers ---
async def start(u: Update, c: ContextTypes.DEFAULT_TYPE):
    chat = u.effective_chat
    user = u.effective_user
    bot_info = await c.bot.get_me()

    if chat.type in ['group', 'supergroup']:
        if str(chat.id) not in groups:
            groups[str(chat.id)] = chat.title
            save_db(DATA_FILE, groups)
        await u.message.reply_text(f"⚙️ '{chat.title}' Group ID ကို ညီမလေး မှတ်သားပြီးပါပြီရှင့်။")
        return

    mention = f"@{user.username}" if user.username else f"[No Username](https://t.me/Tear808)"
    safe_name = user.first_name.replace('*', '').replace('_', '').replace('`', '') if user.first_name else "User"
    text = f"👤 *{safe_name}*\n🆔 `{user.id}`\n🔗 {mention}\n\n💎 *AI Family မိန်းကလေး Bot လေး အဆင်သင့်ရှိနေပါပြီရှင်!*"
    
    try:
        p = await c.bot.get_user_profile_photos(user.id)
        if p.total_count > 0:
            await u.message.reply_photo(p.photos[0][0].file_id, caption=text, reply_markup=get_main_kb(bot_info.username), parse_mode='Markdown')
            return
    except: pass
    await u.message.reply_text(text, reply_markup=get_main_kb(bot_info.username), parse_mode='Markdown')

async def premium_command(u: Update, c: ContextTypes.DEFAULT_TYPE):
    await u.message.reply_text(PREMIUM_INFO_TEXT, parse_mode='Markdown')

async def button_callback(u: Update, c: ContextTypes.DEFAULT_TYPE):
    q = u.callback_query
    await q.answer()
    if q.data == "show_premium":
        await q.message.reply_text(PREMIUM_INFO_TEXT, parse_mode='Markdown')

async def ai_command(u: Update, c: ContextTypes.DEFAULT_TYPE):
    text = u.message.text.replace("/ai", "").strip() if u.message.text else ""
    if not text: 
        await u.message.reply_text("⚠️ မေးခွန်းလေးတစ်ခုခု ရေးပေးပါဦးရှင့်။")
        return
    m = await u.message.reply_text("✨ ညီမလေး စဉ်းစားနေပါတယ်နော်... ခဏလေးစောင့်ပေးပါဦးရှင့်... 💕")
    res = await get_ai(text)
    await c.bot.edit_message_text(res, u.effective_chat.id, m.message_id)

async def photo_command(u: Update, c: ContextTypes.DEFAULT_TYPE):
    user_id = u.effective_user.id
    prompt = u.message.text.replace("/photo", "").strip() if u.message.text else ""
    if not prompt:
        await u.message.reply_text("⚠️ ထုတ်ချင်တဲ့ပုံစံကို အင်္ဂလိပ်လို ရေးပေးပါဦးရှင့်။ ဥပမာ - `/photo a beautiful anime girl` 🌸")
        return

    if not is_premium_user(user_id):
        await u.message.reply_text(PREMIUM_INFO_TEXT, parse_mode='Markdown')
        return

    m = await u.message.reply_text("🎨 AI နဲ့ ပုံလှလှလေး ဆွဲနေပါပြီရှင်... ခဏလေးစောင့်ပေးပါဦးနော်... ⏳")
    image_bytes = await generate_ai_image(prompt)
    if image_bytes:
        await u.message.reply_photo(photo=image_bytes, caption=f"✨ ကိုကို စိတ်ကူးယဉ်ထားတဲ့ ပုံလေး ထွက်လာပါပြီရှင်! 🥰", parse_mode='Markdown')
        await m.delete()
    else:
        await m.edit_text("🤖 ပုံထုတ်တဲ့ စနစ် ခဏအဆင်မပြေဖြစ်နေလို့ နောက်မှ ပြန်စမ်းကြည့်ပေးပါနော် ကိုကို။")

async def sing_command(u: Update, c: ContextTypes.DEFAULT_TYPE):
    user_id = u.effective_user.id
    song_name = u.message.text.replace("/sing", "").strip() if u.message.text else ""
    if not song_name:
        await u.message.reply_text("⚠️ ဆိုခိုင်းချင်တဲ့ သီချင်းခေါင်းစဉ်လေး ရေးပေးပါဦးရှင့်။")
        return

    if not is_premium_user(user_id):
        await u.message.reply_text(PREMIUM_INFO_TEXT, parse_mode='Markdown')
        return

    m = await u.message.reply_text("🎵 ညီမလေး သီချင်းစာသား ရှာဖွေပြီး အသံသွင်းနေပါတယ်ရှင့်... ခဏလေးနော်... 🎤")
    prompt = f"Write the lyrics of the Myanmar song '{song_name}' and act like you are singing it warmly with emotional text and music emojis."
    res = await get_ai(prompt)
    await c.bot.edit_message_text(f"🎤 *ကိုကို တောင်းဆိုထားတဲ့ '{song_name}' သီချင်းလေး ဆိုပြပါမယ်ရှင်!* 🎶\n\n{res}", u.effective_chat.id, m.message_id, parse_mode='Markdown')

async def code_command(u: Update, c: ContextTypes.DEFAULT_TYPE):
    user_id = u.effective_user.id
    req = u.message.text.replace("/code", "").strip() if u.message.text else ""
    if not req:
        await u.message.reply_text("⚠️ ရေးခိုင်းချင်တဲ့ Code ပုံစံကို ရေးပေးပါဦးရှင့်။")
        return

    if not is_premium_user(user_id):
        await u.message.reply_text(PREMIUM_INFO_TEXT, parse_mode='Markdown')
        return

    m = await u.message.reply_text("💻 AI နည်းပညာနဲ့ စနစ်တကျ ကုဒ်ရေးဆွဲပေးနေပါတယ်ရှင်... ⏳")
    prompt = f"Write a professional clean programming code for: {req}. Provide brief explanations inside the code comments."
    res = await get_ai(prompt)
    await c.bot.edit_message_text(res, u.effective_chat.id, m.message_id)

# --- Admin Premium Management ---
async def add_premium(u: Update, c: ContextTypes.DEFAULT_TYPE):
    if u.effective_user.id not in ADMIN_IDS: return
    args = c.args
    if not args:
        await u.message.reply_text("⚠️ ဥပမာ - `/addprem 12345678` ဟု ယူဆာ ID ထည့်ပေးပါ။")
        return
    
    target_id = args[0].strip()
    expire_time = datetime.now() + timedelta(days=30)
    expire_str = expire_time.strftime("%Y-%m-%d %H:%M:%S")
    
    premium_users[target_id] = {
        "start_date": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "expire_date": expire_str
    }
    save_db(PREMIUM_FILE, premium_users)
    await u.message.reply_text(f"✅ User ID: `{target_id}` ကို ၁ လစာ Premium ခွင့်ပြုပေးလိုက်ပါပြီ။")

async def del_premium(u: Update, c: ContextTypes.DEFAULT_TYPE):
    if u.effective_user.id not in ADMIN_IDS: return
    args = c.args
    if not args: return
    target_id = args[0].strip()
    if target_id in premium_users:
        del premium_users[target_id]
        save_db(PREMIUM_FILE, premium_users)
        await u.message.reply_text(f"❌ User ID: `{target_id}` ၏ Premium ကို ဖြုတ်လိုက်ပါပြီရှင်။")

async def check_premium(u: Update, c: ContextTypes.DEFAULT_TYPE):
    if u.effective_user.id not in ADMIN_IDS: return
    active_prems = {uid: data for uid, data in premium_users.items() if is_premium_user(int(uid))}
    if not active_prems:
        await u.message.reply_text("💎 လက်ရှိ Premium ဝယ်ယူထားတဲ့သူ မရှိသေးပါဘူး ကိုကို။")
        return
    report = f"📊 *လက်ရှိ Premium အသုံးပြုသူ စာရင်း ({len(active_prems)} ဦး)*\n\n"
    for uid, data in active_prems.items():
        report += f"• ID: `{uid}` (ကုန်မည့်ရက်: `{data.get('expire_date')}`)\n"
    await u.message.reply_text(report, parse_mode='Markdown')

# --- 📢 Broadcast System ---
async def broadcast_command(u: Update, c: ContextTypes.DEFAULT_TYPE):
    if u.effective_user.id not in ADMIN_IDS: return
    if not u.message.reply_to_message:
        await u.message.reply_text("⚠️ ကြော်ငြာမည့်စာ သို့မဟုတ် ပုံကို Reply ပြန်ပြီး `/bcast` ဟု ရိုက်ပေးပါ ကိုကို။")
        return
    
    m = await u.message.reply_text("📢 Group အားလုံးထံသို့ ကြော်ငြာစာ Forward လုပ်ပေးနေပါတယ်ရှင်...")
    success, total = 0, len(groups)
    for gid in list(groups.keys()):
        try: 
            # copy_message အစား forward_message သုံးလိုက်သည့်အတွက် Channel နာမည် Format အတိုင်းရောက်သွားပါမည်။
            await c.bot.forward_message(chat_id=int(gid), from_chat_id=u.effective_chat.id, message_id=u.message.reply_to_message.message_id)
            success += 1
        except: pass
    await m.edit_text(f"✅ Group စုစုပေါင်း ({total}) ခုအနက် ({success}) ခုသို့ Forward အောင်မြင်ပါပြီရှင်! ✨")

async def teach_command(u: Update, c: ContextTypes.DEFAULT_TYPE):
    if u.effective_user.id not in ADMIN_IDS: return
    txt = u.message.text.replace("/teach", "").strip() if u.message.text else ""
    if ":" in txt:
        p = txt.split(":", 1)
        key, val = p[0].strip(), p[1].strip()
        replies[key] = val
        save_db(REPLY_FILE, replies)
        await u.message.reply_text(f"✅ *မှတ်သားလိုက်ပြီရှင့်!* 📝\n\n📌 မေးခွန်း: {key}\n💬 အဖြေ: {val}")
    else:
        await u.message.reply_text("⚠️ သုံးနည်းမှာ - `/teach မေးခွန်း : အဖြေ` ပုံစံဖြစ်ပါတယ် ကိုကို။")

async def call_group_admins(u: Update, c: ContextTypes.DEFAULT_TYPE):
    chat = u.effective_chat
    if chat.type not in ['group', 'supergroup']: return
    try:
        admins = await c.bot.get_chat_administrators(chat.id)
        mention_text = f"🔊 *Group Admin များရှင်... လူခေါ်နေပါတယ်နော်!* 🔊\n\n🚩 *Admins:* "
        admin_mentions = [f"@{a.user.username}" for a in admins if not a.user.is_bot and a.user.username]
        if admin_mentions:
            await u.message.reply_text(mention_text + " ".join(admin_mentions), parse_mode='Markdown')
    except: pass

# --- Group Ban / Mute / Unmute Logic ---
async def admin_group_actions(u: Update, c: ContextTypes.DEFAULT_TYPE):
    chat = u.effective_chat
    if chat.type not in ['group', 'supergroup']: return
    if not u.message or not u.message.text: return
    
    cmd = u.message.text.split()[0].lower()
    if cmd not in ['/ban', '/mute', '/unmute']: return
    if not u.message.reply_to_message:
        await u.message.reply_text("⚠️ အရေးယူမည့်သူ၏စာကို Reply ပြန်ပြီး ရိုက်ပေးပါ ကိုကို။")
        return
        
    try:
        user_status = (await c.bot.get_chat_member(chat.id, u.effective_user.id)).status
        if user_status in ['creator', 'administrator'] or u.effective_user.id in ADMIN_IDS:
            target_user = u.message.reply_to_message.from_user
            if "/ban" in cmd:
                await c.bot.ban_chat_member(chat.id, target_user.id)
                await u.message.reply_text(f"✅ {target_user.first_name} ကို Group ထဲကနေ မောင်းထုတ်လိုက်ပါပြီ။")
            elif "/mute" in cmd:
                await c.bot.restrict_chat_member(chat.id, target_user.id, permissions=ChatPermissions(can_send_messages=False))
                await u.message.reply_text(f"🔒 {target_user.first_name} ကို စာရိုက်ခွင့် ပိတ်လိုက်ပါပြီရှင်။")
            elif "/unmute" in cmd:
                await c.bot.restrict_chat_member(chat.id, target_user.id, permissions=ChatPermissions(can_send_messages=True, send_audios=True, send_documents=True, send_photos=True, send_videos=True, send_voice_notes=True, send_polls=True, send_other_messages=True, add_web_page_previews=True))
                await u.message.reply_text(f"🔓 {target_user.first_name} ကို စာပြန်ရိုက်ခွင့် ပြုလိုက်ပါပြီ။")
    except Exception as e:
        print(f"Admin action error: {e}")

# --- Message Router & Forward ---
async def msg_handler(u: Update, c: ContextTypes.DEFAULT_TYPE):
    if not u.message: return
    txt = u.message.text.strip() if u.message.text else ""
    chat = u.effective_chat
    user = u.effective_user

    if chat.type in ['group', 'supergroup']:
        if txt in replies: 
            await u.message.reply_text(replies[txt])
        return

    if chat.type == 'private':
        if txt in replies:
            await u.message.reply_text(replies[txt])
        elif not txt.startswith('/'):
            for admin_id in ADMIN_IDS:
                try:
                    await c.bot.send_message(
                        chat_id=admin_id,
                        text=f"📩 *စာရောက်လာပါသည်* 📩\n👤 Name: {user.first_name}\n🆔 ID: `{user.id}`",
                        parse_mode='Markdown'
                    )
                    await c.bot.forward_message(chat_id=admin_id, from_chat_id=chat.id, message_id=u.message.message_id)
                except: pass

async def welcome(u: Update, c: ContextTypes.DEFAULT_TYPE):
    chat = u.effective_chat
    bot_me = await c.bot.get_me()
    if str(chat.id) not in groups:
        groups[str(chat.id)] = chat.title
        save_db(DATA_FILE, groups)

    if u.chat_member.new_chat_members:
        for m in u.chat_member.new_chat_members:
            if m.id == bot_me.id: continue
            mention = f"@{m.username}" if m.username else f"[No Username](https://t.me/Tear808)"
            w_text = f"👋 ဟယ်လို မင်္ဂလာပါရှင်...\n\n🧬 *Name:* {m.first_name}\n🆔 *User ID:* `{m.id}`\n🔗 *Username:* {mention}\n\n*သူကလာလာသစ်လေးအ* 🌸 '*{chat.title}*' Group မှ နွေးထွေးစွာ ကြိုဆိုပါတယ်ရှင်।"
            try:
                p = await c.bot.get_user_profile_photos(m.id)
                if p.total_count > 0:
                    await chat.send_photo(photo=p.photos[0][0].file_id, caption=w_text, parse_mode='Markdown')
                    continue
            except: pass
            await chat.send_message(text=w_text, parse_mode='Markdown')

# Channel မှာစာတင်ရင် Auto Group ထဲကို "Forward Format" အဖြစ် တိုက်ရိုက်ရောက်မည့်စနစ်
async def channel_broadcast(u: Update, c: ContextTypes.DEFAULT_TYPE):
    if u.channel_post:
        for gid in list(groups.keys()):
            try: 
                # copy_message အစား forward_message ပြောင်းလဲပေးထားပါတယ်ရှင်
                await c.bot.forward_message(chat_id=int(gid), from_chat_id=u.channel_post.chat.id, message_id=u.channel_post.message_id)
            except: pass

# --- Render Setup ---
async def init_app():
    ptb = Application.builder().token(BOT_TOKEN).build()
    
    # 1. Channel Handler
    ptb.add_handler(MessageHandler(filters.ChatType.CHANNEL, channel_broadcast))
    
    # 2. Command Handlers
    ptb.add_handler(CommandHandler("start", start))
    ptb.add_handler(CommandHandler("premium", premium_command))
    ptb.add_handler(CommandHandler("ai", ai_command))
    ptb.add_handler(CommandHandler("photo", photo_command))
    ptb.add_handler(CommandHandler("sing", sing_command))
    ptb.add_handler(CommandHandler("code", code_command))
    ptb.add_handler(CommandHandler("admin", call_group_admins))
    ptb.add_handler(CommandHandler("addprem", add_premium))
    ptb.add_handler(CommandHandler("delprem", del_premium))
    ptb.add_handler(CommandHandler("checkprem", check_premium))
    ptb.add_handler(CommandHandler("bcast", broadcast_command))
    ptb.add_handler(CommandHandler("teach", teach_command))
    
    # 3. Admin Group Actions (Ban/Mute/Unmute)
    ptb.add_handler(CommandHandler(["ban", "mute", "unmute"], admin_group_actions))
    
    # 4. Media Private Handlers
    ptb.add_handler(MessageHandler((filters.PHOTO | filters.Document.ALL) & filters.ChatType.PRIVATE, msg_handler))
    
    # 5. Text Message Router
    ptb.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, msg_handler))
    
    ptb.add_handler(ChatMemberHandler(welcome, ChatMemberHandler.CHAT_MEMBER))
    ptb.add_handler(CallbackQueryHandler(button_callback))
    
    await ptb.initialize()
    await ptb.start()
    await ptb.updater.start_polling(drop_pending_updates=True)
    
    app = web.Application()
    app.router.add_get('/', handle_web_request)
    app['ptb'] = ptb
    return app

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    web.run_app(init_app(), host="0.0.0.0", port=port)
  python

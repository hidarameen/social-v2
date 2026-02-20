import type { PlatformType } from "../PlatformIcons";

export interface TriggerDef {
  id: string;
  label: string;
  description: string;
  icon: string;
  fields?: { name: string; label: string; type: "text" | "select" | "number"; options?: string[] }[];
}

export interface ActionDef {
  id: string;
  label: string;
  description: string;
  icon: string;
  fields?: { name: string; label: string; type: "text" | "select" | "textarea" | "number"; options?: string[] }[];
}

export interface PlatformAutomationDef {
  triggers: TriggerDef[];
  actions: ActionDef[];
}

export const platformAutomation: Record<PlatformType, PlatformAutomationDef> = {
  facebook: {
    triggers: [
      { id: "fb_new_post", label: "منشور جديد", description: "عند نشر منشور جديد على الصفحة", icon: "📝" },
      { id: "fb_new_comment", label: "تعليق جديد", description: "عند إضافة تعليق على منشور", icon: "💬" },
      { id: "fb_new_message", label: "رسالة جديدة", description: "عند استلام رسالة في Messenger", icon: "✉️" },
      { id: "fb_new_reaction", label: "تفاعل جديد", description: "عند تفاعل شخص مع منشور", icon: "❤️" },
      { id: "fb_page_mention", label: "إشارة للصفحة", description: "عند الإشارة إلى الصفحة", icon: "🏷️" },
      { id: "fb_new_follower", label: "متابع جديد", description: "عند متابعة شخص للصفحة", icon: "👤" },
      { id: "fb_new_review", label: "تقييم جديد", description: "عند إضافة تقييم للصفحة", icon: "⭐" },
      { id: "fb_lead_form", label: "نموذج عميل محتمل", description: "عند ملء نموذج Lead Ad", icon: "📋" },
    ],
    actions: [
      { id: "fb_create_post", label: "إنشاء منشور", description: "نشر منشور نصي أو وسائط", icon: "📝", fields: [{ name: "message", label: "نص المنشور", type: "textarea" }] },
      { id: "fb_create_story", label: "إنشاء قصة", description: "نشر Story على الصفحة", icon: "📖" },
      { id: "fb_send_message", label: "إرسال رسالة", description: "إرسال رسالة عبر Messenger", icon: "✉️" },
      { id: "fb_comment", label: "إضافة تعليق", description: "التعليق على منشور", icon: "💬" },
      { id: "fb_share_post", label: "مشاركة منشور", description: "مشاركة منشور على الصفحة", icon: "🔄" },
      { id: "fb_update_page", label: "تحديث الصفحة", description: "تحديث معلومات الصفحة", icon: "⚙️" },
    ],
  },
  instagram: {
    triggers: [
      { id: "ig_new_post", label: "منشور جديد", description: "عند نشر صورة أو فيديو", icon: "📸" },
      { id: "ig_new_story", label: "قصة جديدة", description: "عند نشر Story", icon: "📖" },
      { id: "ig_new_reel", label: "Reel جديد", description: "عند نشر Reel", icon: "🎬" },
      { id: "ig_new_comment", label: "تعليق جديد", description: "عند إضافة تعليق", icon: "💬" },
      { id: "ig_new_follower", label: "متابع جديد", description: "عند متابعة حساب جديد", icon: "👤" },
      { id: "ig_new_mention", label: "إشارة جديدة", description: "عند الإشارة في منشور", icon: "🏷️" },
      { id: "ig_new_dm", label: "رسالة مباشرة", description: "عند استلام DM", icon: "✉️" },
      { id: "ig_hashtag_media", label: "منشور بهاشتاق", description: "عند نشر محتوى بهاشتاق محدد", icon: "#️⃣" },
    ],
    actions: [
      { id: "ig_create_post", label: "إنشاء منشور", description: "نشر صورة أو carousel", icon: "📸" },
      { id: "ig_create_story", label: "إنشاء قصة", description: "نشر Story", icon: "📖" },
      { id: "ig_create_reel", label: "إنشاء Reel", description: "نشر Reel جديد", icon: "🎬" },
      { id: "ig_send_dm", label: "إرسال DM", description: "إرسال رسالة مباشرة", icon: "✉️" },
      { id: "ig_comment", label: "إضافة تعليق", description: "التعليق على منشور", icon: "💬" },
      { id: "ig_like", label: "إعجاب بمنشور", description: "الإعجاب بمنشور", icon: "❤️" },
    ],
  },
  twitter: {
    triggers: [
      { id: "tw_new_tweet", label: "تغريدة جديدة", description: "عند نشر تغريدة", icon: "🐦" },
      { id: "tw_new_mention", label: "إشارة جديدة", description: "عند الإشارة إلى الحساب", icon: "🏷️" },
      { id: "tw_new_follower", label: "متابع جديد", description: "عند متابعة شخص جديد", icon: "👤" },
      { id: "tw_new_dm", label: "رسالة مباشرة", description: "عند استلام DM", icon: "✉️" },
      { id: "tw_new_retweet", label: "إعادة تغريد", description: "عند إعادة تغريد منشور", icon: "🔄" },
      { id: "tw_new_like", label: "إعجاب جديد", description: "عند الإعجاب بتغريدة", icon: "❤️" },
      { id: "tw_keyword_match", label: "كلمة مفتاحية", description: "عند ذكر كلمة محددة", icon: "🔍", fields: [{ name: "keyword", label: "الكلمة المفتاحية", type: "text" }] },
      { id: "tw_new_space", label: "Space جديد", description: "عند بدء Space", icon: "🎙️" },
    ],
    actions: [
      { id: "tw_create_tweet", label: "إنشاء تغريدة", description: "نشر تغريدة جديدة", icon: "🐦" },
      { id: "tw_send_dm", label: "إرسال DM", description: "إرسال رسالة مباشرة", icon: "✉️" },
      { id: "tw_retweet", label: "إعادة تغريد", description: "إعادة تغريد منشور", icon: "🔄" },
      { id: "tw_like", label: "إعجاب", description: "الإعجاب بتغريدة", icon: "❤️" },
      { id: "tw_create_thread", label: "إنشاء سلسلة", description: "إنشاء Thread", icon: "🧵" },
      { id: "tw_reply", label: "رد على تغريدة", description: "الرد على تغريدة", icon: "↩️" },
    ],
  },
  linkedin: {
    triggers: [
      { id: "li_new_post", label: "منشور جديد", description: "عند نشر منشور على الصفحة", icon: "📝" },
      { id: "li_new_comment", label: "تعليق جديد", description: "عند إضافة تعليق", icon: "💬" },
      { id: "li_new_connection", label: "اتصال جديد", description: "عند إضافة اتصال", icon: "🤝" },
      { id: "li_new_message", label: "رسالة جديدة", description: "عند استلام رسالة", icon: "✉️" },
      { id: "li_company_mention", label: "إشارة للشركة", description: "عند ذكر الشركة", icon: "🏢" },
      { id: "li_new_follower", label: "متابع جديد", description: "عند متابعة الصفحة", icon: "👤" },
    ],
    actions: [
      { id: "li_create_post", label: "إنشاء منشور", description: "نشر منشور على الصفحة", icon: "📝" },
      { id: "li_send_message", label: "إرسال رسالة", description: "إرسال InMail", icon: "✉️" },
      { id: "li_comment", label: "إضافة تعليق", description: "التعليق على منشور", icon: "💬" },
      { id: "li_share", label: "مشاركة منشور", description: "مشاركة على الصفحة", icon: "🔄" },
      { id: "li_create_article", label: "نشر مقال", description: "نشر مقال على LinkedIn", icon: "📰" },
    ],
  },
  tiktok: {
    triggers: [
      { id: "tt_new_video", label: "فيديو جديد", description: "عند نشر فيديو", icon: "🎬" },
      { id: "tt_new_comment", label: "تعليق جديد", description: "عند إضافة تعليق", icon: "💬" },
      { id: "tt_new_follower", label: "متابع جديد", description: "عند متابعة الحساب", icon: "👤" },
      { id: "tt_new_like", label: "إعجاب جديد", description: "عند الإعجاب بفيديو", icon: "❤️" },
      { id: "tt_video_viral", label: "فيديو منتشر", description: "عند تجاوز عدد محدد من المشاهدات", icon: "🚀", fields: [{ name: "threshold", label: "عدد المشاهدات", type: "number" }] },
      { id: "tt_new_share", label: "مشاركة جديدة", description: "عند مشاركة الفيديو", icon: "🔄" },
    ],
    actions: [
      { id: "tt_upload_video", label: "رفع فيديو", description: "نشر فيديو جديد", icon: "🎬" },
      { id: "tt_comment", label: "إضافة تعليق", description: "التعليق على فيديو", icon: "💬" },
      { id: "tt_reply_comment", label: "رد على تعليق", description: "الرد على تعليق", icon: "↩️" },
    ],
  },
  youtube: {
    triggers: [
      { id: "yt_new_video", label: "فيديو جديد", description: "عند رفع فيديو جديد", icon: "🎬" },
      { id: "yt_new_comment", label: "تعليق جديد", description: "عند إضافة تعليق", icon: "💬" },
      { id: "yt_new_subscriber", label: "مشترك جديد", description: "عند اشتراك شخص", icon: "👤" },
      { id: "yt_new_like", label: "إعجاب جديد", description: "عند الإعجاب بفيديو", icon: "👍" },
      { id: "yt_live_started", label: "بث مباشر", description: "عند بدء بث مباشر", icon: "🔴" },
      { id: "yt_new_short", label: "Short جديد", description: "عند نشر Short", icon: "📱" },
      { id: "yt_milestone", label: "إنجاز جديد", description: "عند تجاوز عدد محدد", icon: "🏆" },
    ],
    actions: [
      { id: "yt_upload_video", label: "رفع فيديو", description: "رفع ونشر فيديو", icon: "🎬" },
      { id: "yt_comment", label: "إضافة تعليق", description: "التعليق على فيديو", icon: "💬" },
      { id: "yt_reply", label: "رد على تعليق", description: "الرد على تعليق", icon: "↩️" },
      { id: "yt_create_playlist", label: "إنشاء قائمة", description: "إنشاء Playlist", icon: "📋" },
      { id: "yt_update_desc", label: "تحديث الوصف", description: "تحديث وصف الفيديو", icon: "✏️" },
      { id: "yt_create_short", label: "إنشاء Short", description: "نشر YouTube Short", icon: "📱" },
    ],
  },
  pinterest: {
    triggers: [
      { id: "pi_new_pin", label: "Pin جديد", description: "عند إنشاء Pin", icon: "📌" },
      { id: "pi_new_board", label: "لوحة جديدة", description: "عند إنشاء Board", icon: "🖼️" },
      { id: "pi_new_follower", label: "متابع جديد", description: "عند متابعة الحساب", icon: "👤" },
      { id: "pi_pin_saved", label: "تم حفظ Pin", description: "عند حفظ شخص لـ Pin", icon: "💾" },
      { id: "pi_pin_click", label: "نقر على Pin", description: "عند النقر على رابط Pin", icon: "🖱️" },
    ],
    actions: [
      { id: "pi_create_pin", label: "إنشاء Pin", description: "إنشاء Pin جديد", icon: "📌" },
      { id: "pi_create_board", label: "إنشاء لوحة", description: "إنشاء Board جديد", icon: "🖼️" },
      { id: "pi_save_pin", label: "حفظ Pin", description: "حفظ Pin في لوحة", icon: "💾" },
    ],
  },
  google_business: {
    triggers: [
      { id: "gb_new_review", label: "تقييم جديد", description: "عند إضافة تقييم للنشاط", icon: "⭐" },
      { id: "gb_new_question", label: "سؤال جديد", description: "عند طرح سؤال", icon: "❓" },
      { id: "gb_new_photo", label: "صورة جديدة", description: "عند إضافة صورة", icon: "📷" },
      { id: "gb_business_update", label: "تحديث النشاط", description: "عند تغيير معلومات النشاط", icon: "🏪" },
      { id: "gb_booking", label: "حجز جديد", description: "عند إجراء حجز", icon: "📅" },
    ],
    actions: [
      { id: "gb_reply_review", label: "الرد على تقييم", description: "الرد على تقييم عميل", icon: "💬" },
      { id: "gb_create_post", label: "إنشاء منشور", description: "نشر تحديث للنشاط", icon: "📝" },
      { id: "gb_update_hours", label: "تحديث الساعات", description: "تحديث ساعات العمل", icon: "🕐" },
      { id: "gb_answer_question", label: "الإجابة على سؤال", description: "الرد على سؤال", icon: "❓" },
    ],
  },
  threads: {
    triggers: [
      { id: "th_new_thread", label: "Thread جديد", description: "عند نشر Thread", icon: "🧵" },
      { id: "th_new_reply", label: "رد جديد", description: "عند الرد على Thread", icon: "↩️" },
      { id: "th_new_follower", label: "متابع جديد", description: "عند متابعة الحساب", icon: "👤" },
      { id: "th_new_mention", label: "إشارة جديدة", description: "عند الإشارة للحساب", icon: "🏷️" },
      { id: "th_new_quote", label: "اقتباس جديد", description: "عند اقتباس Thread", icon: "💬" },
    ],
    actions: [
      { id: "th_create_thread", label: "إنشاء Thread", description: "نشر Thread جديد", icon: "🧵" },
      { id: "th_reply", label: "رد", description: "الرد على Thread", icon: "↩️" },
      { id: "th_repost", label: "إعادة نشر", description: "Repost لـ Thread", icon: "🔄" },
    ],
  },
  snapchat: {
    triggers: [
      { id: "sc_new_story", label: "قصة جديدة", description: "عند نشر Story", icon: "👻" },
      { id: "sc_new_message", label: "رسالة جديدة", description: "عند استلام Snap", icon: "✉️" },
      { id: "sc_screenshot", label: "لقطة شاشة", description: "عند أخذ Screenshot", icon: "📸" },
      { id: "sc_new_follower", label: "متابع جديد", description: "عند إضافة صديق", icon: "👤" },
      { id: "sc_story_view", label: "مشاهدة القصة", description: "عند مشاهدة Story", icon: "👁️" },
    ],
    actions: [
      { id: "sc_create_story", label: "إنشاء قصة", description: "نشر Story", icon: "👻" },
      { id: "sc_send_snap", label: "إرسال Snap", description: "إرسال Snap", icon: "📸" },
      { id: "sc_send_message", label: "إرسال رسالة", description: "إرسال رسالة نصية", icon: "✉️" },
    ],
  },
  telegram: {
    triggers: [
      { id: "tg_new_message", label: "رسالة جديدة", description: "عند استلام رسالة في البوت", icon: "✉️" },
      { id: "tg_channel_post", label: "منشور القناة", description: "عند نشر في القناة", icon: "📢" },
      { id: "tg_new_member", label: "عضو جديد", description: "عند انضمام عضو للمجموعة", icon: "👤" },
      { id: "tg_bot_command", label: "أمر بوت", description: "عند إرسال أمر /command", icon: "🤖", fields: [{ name: "command", label: "الأمر", type: "text" }] },
      { id: "tg_callback_query", label: "Callback Query", description: "عند الضغط على زر inline", icon: "🔘" },
      { id: "tg_file_received", label: "ملف مستلم", description: "عند استلام ملف أو صورة", icon: "📎" },
      { id: "tg_member_left", label: "عضو غادر", description: "عند مغادرة عضو", icon: "🚪" },
    ],
    actions: [
      { id: "tg_send_message", label: "إرسال رسالة", description: "إرسال رسالة نصية", icon: "✉️" },
      { id: "tg_send_photo", label: "إرسال صورة", description: "إرسال صورة مع تعليق", icon: "📷" },
      { id: "tg_send_document", label: "إرسال ملف", description: "إرسال مستند أو ملف", icon: "📎" },
      { id: "tg_forward_message", label: "تحويل رسالة", description: "تحويل رسالة لمحادثة أخرى", icon: "↗️" },
      { id: "tg_pin_message", label: "تثبيت رسالة", description: "تثبيت رسالة في المجموعة", icon: "📌" },
      { id: "tg_create_poll", label: "إنشاء استطلاع", description: "إنشاء تصويت", icon: "📊" },
      { id: "tg_send_sticker", label: "إرسال ملصق", description: "إرسال Sticker", icon: "🎨" },
    ],
  },
  whatsapp: {
    triggers: [
      { id: "wa_new_message", label: "رسالة جديدة", description: "عند استلام رسالة", icon: "✉️" },
      { id: "wa_group_message", label: "رسالة مجموعة", description: "عند رسالة في مجموعة", icon: "👥" },
      { id: "wa_status_update", label: "تحديث الحالة", description: "عند تحديث Status", icon: "📖" },
      { id: "wa_contact_added", label: "جهة اتصال جديدة", description: "عند إضافة جهة اتصال", icon: "👤" },
      { id: "wa_message_read", label: "قراءة الرسالة", description: "عند قراءة رسالة مرسلة", icon: "✅" },
      { id: "wa_button_reply", label: "رد على زر", description: "عند الضغط على Quick Reply", icon: "🔘" },
    ],
    actions: [
      { id: "wa_send_message", label: "إرسال رسالة", description: "إرسال رسالة نصية", icon: "✉️" },
      { id: "wa_send_image", label: "إرسال صورة", description: "إرسال صورة مع تعليق", icon: "📷" },
      { id: "wa_send_document", label: "إرسال مستند", description: "إرسال ملف PDF أو مستند", icon: "📎" },
      { id: "wa_send_location", label: "إرسال موقع", description: "إرسال موقع جغرافي", icon: "📍" },
      { id: "wa_send_template", label: "إرسال قالب", description: "إرسال قالب معتمد", icon: "📋" },
      { id: "wa_create_group", label: "إنشاء مجموعة", description: "إنشاء مجموعة جديدة", icon: "👥" },
    ],
  },
};

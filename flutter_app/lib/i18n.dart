class I18n {
  I18n(this.locale);

  final String locale; // 'ar' | 'en'

  bool get isArabic => locale == 'ar';

  String t(String key, String fallback) {
    final dict = isArabic ? _ar : _en;
    return dict[key] ?? fallback;
  }

  static const Map<String, String> _en = {
    'auth.signInTitle': 'Sign In',
    'auth.signInDesc': 'Access your verified workspace and continue your automation flow.',
    'auth.registerTitle': 'Create Account',
    'auth.registerDesc': 'Start securely with verified email access and strong credential requirements.',
    'auth.email': 'Email',
    'auth.password': 'Password',
    'auth.fullName': 'Full Name',
    'auth.confirmPassword': 'Confirm Password',
    'auth.rememberMe': 'Remember me',
    'auth.forgotPassword': 'Forgot password?',
    'auth.createAccount': 'Create Account',
    'auth.signIn': 'Sign In',
    'auth.checkEmailTitle': 'Check Your Email',
    'auth.checkEmailDesc': 'Your account has been created. Verify your email to activate secure sign in.',
    'auth.verificationRequired': 'Verification Required',
    'auth.enterVerificationCode': 'Enter Verification Code',
    'auth.resendCode': 'Resend Code',
    'auth.verificationCode': 'Verification code',
    'auth.verifyEmail': 'Verify Email',
    'auth.verifyAndSignIn': 'Verify Email and Sign In',
    'auth.passwordStrength': 'Password strength',
    'auth.termsAgree': 'I agree to the Terms of Service and Privacy Policy.',
    'auth.alreadyHaveAccount': 'Already have an account?',
    'auth.noAccount': "Don't have an account?",
    'auth.goToRegister': 'Create one',
    'auth.goToLogin': 'Sign in',
    'auth.rights': 'All rights reserved',
    'auth.credit': 'Programming & Design: Oday Algholy',

    'auth.passwordRule.length': 'At least 8 characters',
    'auth.passwordRule.upper': 'At least one uppercase letter',
    'auth.passwordRule.lower': 'At least one lowercase letter',
    'auth.passwordRule.number': 'At least one number',
    'auth.passwordRule.special': 'At least one special character',

    'auth.identity': 'SocialFlow Identity',
    'auth.secureAccessTitle': 'Secure access to your automation workspace',
    'auth.secureAccessDescription':
        'Built for operators managing high-volume cross-platform workflows with enterprise-grade account protection.',
    'auth.verificationTitle': 'Verification First',
    'auth.verificationDescription':
        'Email verification protects account ownership from day one.',
    'auth.sessionTitle': 'Fast Session Access',
    'auth.sessionDescription':
        'Smart sign-in experience with callback routing and quick recovery flows.',
    'auth.uxTitle': 'Role-ready UX',
    'auth.uxDescription': 'Optimized for validation clarity and accessibility.',
  };

  static const Map<String, String> _ar = {
    'auth.signInTitle': 'تسجيل الدخول',
    'auth.signInDesc': 'ادخل إلى مساحة العمل الموثقة وتابع الأتمتة الخاصة بك.',
    'auth.registerTitle': 'إنشاء حساب',
    'auth.registerDesc': 'ابدأ بأمان عبر التحقق من البريد وكلمة مرور قوية.',
    'auth.email': 'البريد الإلكتروني',
    'auth.password': 'كلمة المرور',
    'auth.fullName': 'الاسم الكامل',
    'auth.confirmPassword': 'تأكيد كلمة المرور',
    'auth.rememberMe': 'تذكرني',
    'auth.forgotPassword': 'نسيت كلمة المرور؟',
    'auth.createAccount': 'إنشاء حساب',
    'auth.signIn': 'تسجيل الدخول',
    'auth.checkEmailTitle': 'تحقق من بريدك',
    'auth.checkEmailDesc': 'تم إنشاء الحساب. يرجى التحقق من بريدك لتفعيل تسجيل الدخول.',
    'auth.verificationRequired': 'التحقق مطلوب',
    'auth.enterVerificationCode': 'إدخال رمز التحقق',
    'auth.resendCode': 'إعادة إرسال الرمز',
    'auth.verificationCode': 'رمز التحقق',
    'auth.verifyEmail': 'تحقق من البريد',
    'auth.verifyAndSignIn': 'تحقق وتسجيل الدخول',
    'auth.passwordStrength': 'قوة كلمة المرور',
    'auth.termsAgree': 'أوافق على شروط الخدمة وسياسة الخصوصية.',
    'auth.alreadyHaveAccount': 'لديك حساب بالفعل؟',
    'auth.noAccount': 'ليس لديك حساب؟',
    'auth.goToRegister': 'إنشاء حساب',
    'auth.goToLogin': 'تسجيل الدخول',
    'auth.rights': 'جميع الحقوق محفوظة',
    'auth.credit': 'برمجة وتصميم: Oday Algholy',

    'auth.passwordRule.length': '٨ أحرف على الأقل',
    'auth.passwordRule.upper': 'حرف كبير واحد على الأقل',
    'auth.passwordRule.lower': 'حرف صغير واحد على الأقل',
    'auth.passwordRule.number': 'رقم واحد على الأقل',
    'auth.passwordRule.special': 'رمز خاص واحد على الأقل',

    'auth.identity': 'هوية SocialFlow',
    'auth.secureAccessTitle': 'وصول آمن لمساحة الأتمتة الخاصة بك',
    'auth.secureAccessDescription':
        'مصمم للمشغلين الذين يديرون تدفقات عمل عالية الحجم عبر منصات متعددة بحماية على مستوى المؤسسات.',
    'auth.verificationTitle': 'التحقق أولاً',
    'auth.verificationDescription': 'التحقق من البريد يحمي ملكية الحساب منذ البداية.',
    'auth.sessionTitle': 'دخول سريع',
    'auth.sessionDescription': 'تجربة تسجيل دخول ذكية مع استعادة سريعة.',
    'auth.uxTitle': 'واجهة جاهزة للعمل',
    'auth.uxDescription': 'محسنة لوضوح التحقق وإمكانية الوصول.',
  };
}

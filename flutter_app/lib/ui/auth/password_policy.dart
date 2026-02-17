class PasswordRule {
  const PasswordRule(this.id, this.testKey, this.test);

  final String id;
  final String testKey; // i18n key
  final bool Function(String value) test;
}

const List<PasswordRule> kPasswordRules = [
  PasswordRule('length', 'auth.passwordRule.length', _hasLength),
  PasswordRule('upper', 'auth.passwordRule.upper', _hasUpper),
  PasswordRule('lower', 'auth.passwordRule.lower', _hasLower),
  PasswordRule('number', 'auth.passwordRule.number', _hasNumber),
  PasswordRule('special', 'auth.passwordRule.special', _hasSpecial),
];

bool _hasLength(String value) => value.length >= 8;
bool _hasUpper(String value) => RegExp(r'[A-Z]').hasMatch(value);
bool _hasLower(String value) => RegExp(r'[a-z]').hasMatch(value);
bool _hasNumber(String value) => RegExp(r'[0-9]').hasMatch(value);
bool _hasSpecial(String value) => RegExp(r'[^A-Za-z0-9]').hasMatch(value);

int passwordStrengthScore(String value) {
  var score = 0;
  for (final rule in kPasswordRules) {
    if (rule.test(value)) score += 1;
  }
  return score;
}

bool passwordMeetsPolicy(String value) {
  for (final rule in kPasswordRules) {
    if (!rule.test(value)) return false;
  }
  return true;
}


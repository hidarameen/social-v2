import 'dart:convert';
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../api/api_client.dart';
import '../../i18n.dart';
import '../platform_brand.dart';
import '../widgets/sf_ui.dart';

const List<String> _kPlatformOrder = <String>[
  'facebook',
  'instagram',
  'twitter',
  'tiktok',
  'youtube',
  'telegram',
  'linkedin',
];

const String _kDefaultYouTubeCategoryId = '22';

const List<Map<String, String>> _kYouTubeCategories = <Map<String, String>>[
  {'id': '1', 'name': 'Film & Animation'},
  {'id': '2', 'name': 'Autos & Vehicles'},
  {'id': '10', 'name': 'Music'},
  {'id': '15', 'name': 'Pets & Animals'},
  {'id': '17', 'name': 'Sports'},
  {'id': '19', 'name': 'Travel & Events'},
  {'id': '20', 'name': 'Gaming'},
  {'id': '22', 'name': 'People & Blogs'},
  {'id': '23', 'name': 'Comedy'},
  {'id': '24', 'name': 'Entertainment'},
  {'id': '25', 'name': 'News & Politics'},
  {'id': '26', 'name': 'Howto & Style'},
  {'id': '27', 'name': 'Education'},
  {'id': '28', 'name': 'Science & Technology'},
  {'id': '29', 'name': 'Nonprofits & Activism'},
];

const List<String> _kTwitterTriggerTypes = <String>[
  'on_tweet',
  'on_mention',
  'on_keyword',
  'on_hashtag',
  'on_search',
  'on_retweet',
  'on_like',
];

const String _kTaskDraftKey = 'socialflow:task-wizard:create';

class TaskComposerSheet extends StatefulWidget {
  const TaskComposerSheet({
    super.key,
    required this.api,
    required this.accessToken,
    required this.i18n,
    this.initialTask,
  });

  final ApiClient api;
  final String accessToken;
  final I18n i18n;
  final Map<String, dynamic>? initialTask;

  @override
  State<TaskComposerSheet> createState() => _TaskComposerSheetState();
}

class _TaskComposerSheetState extends State<TaskComposerSheet> {
  final GlobalKey<FormState> _formKey = GlobalKey<FormState>();

  final TextEditingController _nameController = TextEditingController();
  final TextEditingController _descController = TextEditingController();
  final TextEditingController _sourceSearchController = TextEditingController();
  final TextEditingController _targetSearchController = TextEditingController();
  final TextEditingController _templateController = TextEditingController();
  final TextEditingController _twitterUsernameController =
      TextEditingController();
  final TextEditingController _triggerValueController = TextEditingController();
  final TextEditingController _sourceChatInputController =
      TextEditingController();
  final TextEditingController _targetChatInputController =
      TextEditingController();

  final TextEditingController _ytTitleTemplateController =
      TextEditingController();
  final TextEditingController _ytDescriptionTemplateController =
      TextEditingController();
  final TextEditingController _ytTagsController = TextEditingController();
  final TextEditingController _ytPublishAtController = TextEditingController();
  final TextEditingController _ytDefaultLanguageController =
      TextEditingController();
  final TextEditingController _ytDefaultAudioLanguageController =
      TextEditingController();
  final TextEditingController _ytRecordingDateController =
      TextEditingController();

  final Set<String> _sourceAccountIds = <String>{};
  final Set<String> _targetAccountIds = <String>{};
  final List<String> _telegramSourceChatIds = <String>[];
  final List<String> _telegramTargetChatIds = <String>[];

  bool _loadingAccounts = true;
  bool _busy = false;
  String _error = '';
  int _step = 1;

  bool _includeMedia = true;
  bool _enableYtDlp = false;

  String _twitterSourceType = 'account';
  bool _excludeReplies = false;
  bool _excludeRetweets = false;
  bool _excludeQuotes = false;
  bool _originalOnly = false;
  int _pollIntervalSeconds = 60;
  String _triggerType = 'on_tweet';

  final Map<String, bool> _twitterActions = <String, bool>{
    'post': true,
    'reply': false,
    'quote': false,
    'retweet': false,
    'like': false,
  };

  bool _ytUploadVideo = true;
  bool _ytUploadVideoToPlaylist = false;
  String _ytPlaylistId = '';

  String _ytPrivacyStatus = 'public';
  String _ytCategoryId = _kDefaultYouTubeCategoryId;
  bool _ytEmbeddable = true;
  String _ytLicense = 'youtube';
  bool _ytPublicStatsViewable = true;
  bool _ytMadeForKids = false;
  bool _ytNotifySubscribers = true;

  List<Map<String, dynamic>> _accounts = <Map<String, dynamic>>[];
  Timer? _draftTimer;

  bool get _isEdit {
    final id = widget.initialTask?['id']?.toString() ?? '';
    return id.trim().isNotEmpty;
  }

  String get _taskId {
    return widget.initialTask?['id']?.toString() ?? '';
  }

  String _t(String en, String ar) => widget.i18n.isArabic ? ar : en;

  @override
  void initState() {
    super.initState();
    _applyInitialTask(widget.initialTask);
    if (!_isEdit) {
      unawaited(_restoreDraft());
    }
    unawaited(_loadAccounts());
  }

  @override
  void dispose() {
    _draftTimer?.cancel();

    _nameController.dispose();
    _descController.dispose();
    _sourceSearchController.dispose();
    _targetSearchController.dispose();
    _templateController.dispose();
    _twitterUsernameController.dispose();
    _triggerValueController.dispose();
    _sourceChatInputController.dispose();
    _targetChatInputController.dispose();
    _ytTitleTemplateController.dispose();
    _ytDescriptionTemplateController.dispose();
    _ytTagsController.dispose();
    _ytPublishAtController.dispose();
    _ytDefaultLanguageController.dispose();
    _ytDefaultAudioLanguageController.dispose();
    _ytRecordingDateController.dispose();

    super.dispose();
  }

  IconData _platformIcon(String platformId) => platformBrandIcon(platformId);

  Color _platformColor(String platformId) {
    final theme = Theme.of(context);
    return platformBrandColor(
      platformId,
      scheme: theme.colorScheme,
      isDark: theme.brightness == Brightness.dark,
    );
  }

  String _platformLabel(String platformId) {
    final normalized = platformId.trim().toLowerCase();
    if (normalized == 'twitter' || normalized == 'x') return 'Twitter / X';
    if (normalized == 'youtube') return 'YouTube';
    if (normalized == 'tiktok') return 'TikTok';
    if (normalized == 'telegram') return 'Telegram';
    if (normalized == 'linkedin') return 'LinkedIn';
    if (normalized == 'instagram') return 'Instagram';
    if (normalized == 'facebook') return 'Facebook';
    if (normalized.isEmpty) return 'Unknown';
    return '${normalized[0].toUpperCase()}${normalized.substring(1)}';
  }

  String _accountLabel(Map<String, dynamic> account) {
    final name = (account['accountName']?.toString() ?? '').trim();
    final username = (account['accountUsername']?.toString() ?? '').trim();
    if (name.isNotEmpty) return name;
    if (username.isNotEmpty) return '@$username';
    final accountId = (account['accountId']?.toString() ?? '').trim();
    if (accountId.isNotEmpty) return accountId;
    return account['id']?.toString() ?? 'Account';
  }

  List<Map<String, dynamic>> _selectedAccounts(Set<String> ids) {
    final idSet = ids;
    return _accounts.where((account) {
      final id = account['id']?.toString() ?? '';
      return idSet.contains(id);
    }).toList();
  }

  List<Map<String, dynamic>> get _selectedSourceAccounts =>
      _selectedAccounts(_sourceAccountIds);

  List<Map<String, dynamic>> get _selectedTargetAccounts =>
      _selectedAccounts(_targetAccountIds);

  bool get _hasTwitterSource => _selectedSourceAccounts
      .any((a) => (a['platformId']?.toString() ?? '') == 'twitter');

  bool get _hasTwitterTarget => _selectedTargetAccounts
      .any((a) => (a['platformId']?.toString() ?? '') == 'twitter');

  bool get _hasTelegramSource => _selectedSourceAccounts
      .any((a) => (a['platformId']?.toString() ?? '') == 'telegram');

  bool get _hasTelegramTarget => _selectedTargetAccounts
      .any((a) => (a['platformId']?.toString() ?? '') == 'telegram');

  bool get _hasYouTubeTarget => _selectedTargetAccounts
      .any((a) => (a['platformId']?.toString() ?? '') == 'youtube');

  List<String> _selectedPlatforms(List<Map<String, dynamic>> selected) {
    final seen = <String>{};
    for (final account in selected) {
      final platform =
          (account['platformId']?.toString() ?? '').trim().toLowerCase();
      if (platform.isNotEmpty) seen.add(platform);
    }

    final ordered = <String>[];
    for (final platform in _kPlatformOrder) {
      if (seen.contains(platform)) ordered.add(platform);
    }
    for (final platform in seen) {
      if (!ordered.contains(platform)) ordered.add(platform);
    }
    return ordered;
  }

  List<String> get _sourcePlatforms =>
      _selectedPlatforms(_selectedSourceAccounts);

  List<String> get _targetPlatforms =>
      _selectedPlatforms(_selectedTargetAccounts);

  List<Map<String, String>> get _youtubePlaylists {
    final out = <Map<String, String>>[];
    final seen = <String>{};

    for (final account in _selectedTargetAccounts) {
      if ((account['platformId']?.toString() ?? '') != 'youtube') continue;
      final credentials = account['credentials'];
      final available = credentials is Map<String, dynamic>
          ? credentials['availablePlaylists']
          : null;
      if (available is! List) continue;

      for (final item in available) {
        if (item is! Map) continue;
        final id = '${item['id'] ?? ''}'.trim();
        final title = '${item['title'] ?? item['id'] ?? ''}'.trim();
        if (id.isEmpty || title.isEmpty || seen.contains(id)) continue;
        seen.add(id);
        out.add(<String, String>{'id': id, 'title': title});
      }
    }

    return out;
  }

  List<Map<String, dynamic>> _candidateAccounts({required bool source}) {
    final query =
        (source ? _sourceSearchController.text : _targetSearchController.text)
            .trim()
            .toLowerCase();
    if (query.isEmpty) return List<Map<String, dynamic>>.from(_accounts);

    return _accounts.where((account) {
      final hay = [
        account['platformId'],
        account['accountName'],
        account['accountUsername'],
        account['accountId'],
        account['id'],
      ].join(' ').toLowerCase();
      return hay.contains(query);
    }).toList();
  }

  List<MapEntry<String, List<Map<String, dynamic>>>> _groupedCandidates(
      {required bool source}) {
    final groups = <String, List<Map<String, dynamic>>>{};
    for (final account in _candidateAccounts(source: source)) {
      final platform =
          (account['platformId']?.toString() ?? 'unknown').trim().toLowerCase();
      groups.putIfAbsent(platform, () => <Map<String, dynamic>>[]).add(account);
    }

    final keys = <String>[];
    for (final platform in _kPlatformOrder) {
      if (groups.containsKey(platform)) keys.add(platform);
    }
    final extras =
        groups.keys.where((k) => !_kPlatformOrder.contains(k)).toList()..sort();
    keys.addAll(extras);

    return keys
        .map((k) => MapEntry(k, groups[k] ?? <Map<String, dynamic>>[]))
        .toList();
  }

  void _onFormChanged() {
    if (_error.isNotEmpty) {
      setState(() => _error = '');
    } else {
      setState(() {});
    }
    _persistDraftSoon();
  }

  void _setError(String message, {bool toast = false}) {
    setState(() => _error = message);
    if (toast) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(message), behavior: SnackBarBehavior.floating));
    }
  }

  void _persistDraftSoon() {
    if (_isEdit) return;
    _draftTimer?.cancel();
    _draftTimer = Timer(const Duration(milliseconds: 300), () {
      unawaited(_persistDraftNow());
    });
  }

  Future<void> _persistDraftNow() async {
    if (_isEdit) return;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_kTaskDraftKey, _encodeDraft());
  }

  String _encodeDraft() {
    final payload = <String, dynamic>{
      'name': _nameController.text,
      'description': _descController.text,
      'step': _step,
      'sourceAccountIds': _sourceAccountIds.toList(),
      'targetAccountIds': _targetAccountIds.toList(),
      'template': _templateController.text,
      'includeMedia': _includeMedia,
      'enableYtDlp': _enableYtDlp,
      'twitterSourceType': _twitterSourceType,
      'twitterUsername': _twitterUsernameController.text,
      'excludeReplies': _excludeReplies,
      'excludeRetweets': _excludeRetweets,
      'excludeQuotes': _excludeQuotes,
      'originalOnly': _originalOnly,
      'pollIntervalSeconds': _pollIntervalSeconds,
      'triggerType': _triggerType,
      'triggerValue': _triggerValueController.text,
      'telegramSourceChatIds': _telegramSourceChatIds,
      'telegramTargetChatIds': _telegramTargetChatIds,
      'twitterActions': _twitterActions,
      'ytUploadVideo': _ytUploadVideo,
      'ytUploadVideoToPlaylist': _ytUploadVideoToPlaylist,
      'ytPlaylistId': _ytPlaylistId,
      'ytTitleTemplate': _ytTitleTemplateController.text,
      'ytDescriptionTemplate': _ytDescriptionTemplateController.text,
      'ytTags': _ytTagsController.text,
      'ytPrivacyStatus': _ytPrivacyStatus,
      'ytCategoryId': _ytCategoryId,
      'ytEmbeddable': _ytEmbeddable,
      'ytLicense': _ytLicense,
      'ytPublicStatsViewable': _ytPublicStatsViewable,
      'ytMadeForKids': _ytMadeForKids,
      'ytNotifySubscribers': _ytNotifySubscribers,
      'ytPublishAt': _ytPublishAtController.text,
      'ytDefaultLanguage': _ytDefaultLanguageController.text,
      'ytDefaultAudioLanguage': _ytDefaultAudioLanguageController.text,
      'ytRecordingDate': _ytRecordingDateController.text,
    };
    return jsonEncode(payload);
  }

  Map<String, dynamic> _decodeDraft(String raw) {
    try {
      final parsed = jsonDecode(raw);
      if (parsed is Map<String, dynamic>) return parsed;
      return <String, dynamic>{};
    } catch (_) {
      return <String, dynamic>{};
    }
  }

  Future<void> _restoreDraft() async {
    if (_isEdit) return;

    try {
      final prefs = await SharedPreferences.getInstance();
      final raw = prefs.getString(_kTaskDraftKey);
      if (raw == null || raw.trim().isEmpty) return;

      final data = _decodeDraft(raw);
      if (!mounted || data.isEmpty) return;

      setState(() {
        _nameController.text = '${data['name'] ?? ''}';
        _descController.text = '${data['description'] ?? ''}';
        _templateController.text = '${data['template'] ?? ''}';
        _twitterUsernameController.text = '${data['twitterUsername'] ?? ''}';
        _triggerValueController.text = '${data['triggerValue'] ?? ''}';
        _ytTitleTemplateController.text = '${data['ytTitleTemplate'] ?? ''}';
        _ytDescriptionTemplateController.text =
            '${data['ytDescriptionTemplate'] ?? ''}';
        _ytTagsController.text = '${data['ytTags'] ?? ''}';
        _ytPublishAtController.text = '${data['ytPublishAt'] ?? ''}';
        _ytDefaultLanguageController.text =
            '${data['ytDefaultLanguage'] ?? ''}';
        _ytDefaultAudioLanguageController.text =
            '${data['ytDefaultAudioLanguage'] ?? ''}';
        _ytRecordingDateController.text = '${data['ytRecordingDate'] ?? ''}';

        final step = int.tryParse('${data['step'] ?? ''}') ?? 1;
        _step = step.clamp(1, 5);

        _includeMedia = '${data['includeMedia']}'.toLowerCase() != 'false';
        _enableYtDlp = '${data['enableYtDlp']}'.toLowerCase() == 'true';

        final type = '${data['twitterSourceType'] ?? ''}'.trim();
        if (type == 'account' || type == 'username') _twitterSourceType = type;

        _excludeReplies = '${data['excludeReplies']}'.toLowerCase() == 'true';
        _excludeRetweets = '${data['excludeRetweets']}'.toLowerCase() == 'true';
        _excludeQuotes = '${data['excludeQuotes']}'.toLowerCase() == 'true';
        _originalOnly = '${data['originalOnly']}'.toLowerCase() == 'true';

        final poll = int.tryParse('${data['pollIntervalSeconds'] ?? ''}') ?? 60;
        _pollIntervalSeconds = poll < 10 ? 10 : poll;

        final trigger = '${data['triggerType'] ?? ''}'.trim();
        if (_kTwitterTriggerTypes.contains(trigger)) _triggerType = trigger;

        _ytUploadVideo = '${data['ytUploadVideo']}'.toLowerCase() != 'false';
        _ytUploadVideoToPlaylist =
            '${data['ytUploadVideoToPlaylist']}'.toLowerCase() == 'true';
        _ytPlaylistId = '${data['ytPlaylistId'] ?? ''}'.trim();

        final privacy = '${data['ytPrivacyStatus'] ?? ''}'.trim();
        if (privacy == 'private' ||
            privacy == 'unlisted' ||
            privacy == 'public') {
          _ytPrivacyStatus = privacy;
        }

        _ytCategoryId =
            _resolveYouTubeCategoryId('${data['ytCategoryId'] ?? ''}') ??
                _kDefaultYouTubeCategoryId;

        _ytEmbeddable = '${data['ytEmbeddable']}'.toLowerCase() != 'false';
        final license = '${data['ytLicense'] ?? ''}'.trim();
        if (license == 'youtube' || license == 'creativeCommon')
          _ytLicense = license;
        _ytPublicStatsViewable =
            '${data['ytPublicStatsViewable']}'.toLowerCase() != 'false';
        _ytMadeForKids = '${data['ytMadeForKids']}'.toLowerCase() == 'true';
        _ytNotifySubscribers =
            '${data['ytNotifySubscribers']}'.toLowerCase() != 'false';
      });
    } catch (_) {
      // Ignore corrupt draft safely.
    }
  }

  Future<void> _clearDraft() async {
    if (_isEdit) return;
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_kTaskDraftKey);
  }

  void _applyInitialTask(Map<String, dynamic>? task) {
    if (task == null) return;

    _nameController.text = '${task['name'] ?? ''}';
    _descController.text = '${task['description'] ?? ''}';

    final source = task['sourceAccounts'];
    if (source is List) {
      _sourceAccountIds
        ..clear()
        ..addAll(source.map((v) => '$v').where((v) => v.trim().isNotEmpty));
    }

    final target = task['targetAccounts'];
    if (target is List) {
      _targetAccountIds
        ..clear()
        ..addAll(target.map((v) => '$v').where((v) => v.trim().isNotEmpty));
    }

    final filters = task['filters'] is Map<String, dynamic>
        ? task['filters'] as Map<String, dynamic>
        : <String, dynamic>{};

    final transformations = task['transformations'] is Map<String, dynamic>
        ? task['transformations'] as Map<String, dynamic>
        : <String, dynamic>{};

    _templateController.text = '${transformations['template'] ?? ''}';
    _includeMedia = transformations['includeMedia'] != false;
    _enableYtDlp = transformations['enableYtDlp'] == true;

    final srcType = '${filters['twitterSourceType'] ?? ''}'.trim();
    if (srcType == 'account' || srcType == 'username') {
      _twitterSourceType = srcType;
    }

    _twitterUsernameController.text = '${filters['twitterUsername'] ?? ''}';
    _excludeReplies = filters['excludeReplies'] == true;
    _excludeRetweets = filters['excludeRetweets'] == true;
    _excludeQuotes = filters['excludeQuotes'] == true;
    _originalOnly = filters['originalOnly'] == true;

    final poll = int.tryParse('${filters['pollIntervalSeconds'] ?? 60}') ?? 60;
    _pollIntervalSeconds = poll < 10 ? 10 : poll;

    final triggerType = '${filters['triggerType'] ?? 'on_tweet'}';
    if (_kTwitterTriggerTypes.contains(triggerType)) {
      _triggerType = triggerType;
    }
    _triggerValueController.text = '${filters['triggerValue'] ?? ''}';

    _telegramSourceChatIds
      ..clear()
      ..addAll(_uniqueIds([
        ..._parseTelegramChatIdentifiers('${filters['telegramChatId'] ?? ''}'),
        if (filters['telegramChatIds'] is List)
          ...(filters['telegramChatIds'] as List).map((v) => '$v'),
      ]));

    _telegramTargetChatIds
      ..clear()
      ..addAll(_uniqueIds([
        ..._parseTelegramChatIdentifiers(
            '${transformations['telegramTargetChatId'] ?? ''}'),
        if (transformations['telegramTargetChatIds'] is List)
          ...(transformations['telegramTargetChatIds'] as List)
              .map((v) => '$v'),
      ]));

    final twActions = transformations['twitterActions'];
    if (twActions is Map<String, dynamic>) {
      _twitterActions['post'] = twActions['post'] != false;
      _twitterActions['reply'] = twActions['reply'] == true;
      _twitterActions['quote'] = twActions['quote'] == true;
      _twitterActions['retweet'] = twActions['retweet'] == true;
      _twitterActions['like'] = twActions['like'] == true;
    }

    final ytActions = transformations['youtubeActions'];
    if (ytActions is Map<String, dynamic>) {
      _ytUploadVideo = ytActions['uploadVideo'] != false;
      _ytUploadVideoToPlaylist = ytActions['uploadVideoToPlaylist'] == true;
      _ytPlaylistId = '${ytActions['playlistId'] ?? ''}'.trim();
    }

    final ytVideo = transformations['youtubeVideo'];
    if (ytVideo is Map<String, dynamic>) {
      _ytTitleTemplateController.text = '${ytVideo['titleTemplate'] ?? ''}';
      _ytDescriptionTemplateController.text =
          '${ytVideo['descriptionTemplate'] ?? ''}';
      if (ytVideo['tags'] is List) {
        _ytTagsController.text = (ytVideo['tags'] as List)
            .map((v) => '$v'.trim())
            .where((v) => v.isNotEmpty)
            .join(', ');
      }

      final privacy = '${ytVideo['privacyStatus'] ?? ''}'.trim();
      if (privacy == 'private' ||
          privacy == 'unlisted' ||
          privacy == 'public') {
        _ytPrivacyStatus = privacy;
      }
      _ytCategoryId =
          _resolveYouTubeCategoryId('${ytVideo['categoryId'] ?? ''}') ??
              _kDefaultYouTubeCategoryId;

      _ytEmbeddable = ytVideo['embeddable'] != false;
      final license = '${ytVideo['license'] ?? ''}'.trim();
      if (license == 'youtube' || license == 'creativeCommon')
        _ytLicense = license;
      _ytPublicStatsViewable = ytVideo['publicStatsViewable'] != false;
      _ytMadeForKids = ytVideo['selfDeclaredMadeForKids'] == true;
      _ytNotifySubscribers = ytVideo['notifySubscribers'] != false;

      _ytPublishAtController.text =
          _toLocalDateTimeInput('${ytVideo['publishAt'] ?? ''}');
      _ytDefaultLanguageController.text = '${ytVideo['defaultLanguage'] ?? ''}';
      _ytDefaultAudioLanguageController.text =
          '${ytVideo['defaultAudioLanguage'] ?? ''}';
      _ytRecordingDateController.text =
          _toDateInput('${ytVideo['recordingDate'] ?? ''}');
    }
  }

  Future<void> _loadAccounts() async {
    setState(() {
      _loadingAccounts = true;
      _error = '';
    });

    try {
      final payload =
          await widget.api.fetchAccounts(widget.accessToken, limit: 200);
      final raw = payload['accounts'];
      final list = raw is List ? raw : const <dynamic>[];

      final parsed = list
          .map((entry) {
            if (entry is! Map) return <String, dynamic>{};
            final map = Map<String, dynamic>.from(entry);
            return <String, dynamic>{
              'id': '${map['id'] ?? ''}',
              'platformId': ('${map['platformId'] ?? 'unknown'}').toLowerCase(),
              'accountName': '${map['accountName'] ?? ''}',
              'accountUsername': '${map['accountUsername'] ?? ''}',
              'accountId': '${map['accountId'] ?? ''}',
              'isActive': map['isActive'] == true,
              'credentials': map['credentials'] is Map<String, dynamic>
                  ? map['credentials'] as Map<String, dynamic>
                  : <String, dynamic>{},
            };
          })
          .where((item) => (item['id']?.toString() ?? '').trim().isNotEmpty)
          .toList();

      parsed.sort((a, b) {
        final ap = (a['platformId']?.toString() ?? '')
            .compareTo(b['platformId']?.toString() ?? '');
        if (ap != 0) return ap;
        return _accountLabel(a)
            .toLowerCase()
            .compareTo(_accountLabel(b).toLowerCase());
      });

      if (!mounted) return;
      setState(() {
        _accounts = parsed;
        _loadingAccounts = false;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _loadingAccounts = false;
        _error =
            error is ApiException ? error.message : 'Failed to load accounts.';
      });
    }
  }

  List<String> _uniqueIds(List<String> ids) {
    final out = <String>[];
    final seen = <String>{};
    for (final raw in ids) {
      final value = raw.trim();
      if (value.isEmpty || seen.contains(value)) continue;
      seen.add(value);
      out.add(value);
    }
    return out;
  }

  String? _parseTelegramChatIdentifier(String rawValue) {
    final raw = rawValue.trim();
    if (raw.isEmpty) return null;

    final digitsOnly = RegExp(r'^-?\d+$');
    if (digitsOnly.hasMatch(raw)) return raw;
    if (raw.startsWith('@')) return raw.toLowerCase();

    final direct = raw.replaceAll(RegExp(r'\s+'), '');
    final normalized = direct.toLowerCase();

    if (normalized.startsWith('t.me/') ||
        normalized.startsWith('telegram.me/') ||
        normalized.startsWith('https://t.me/')) {
      final withProtocol =
          normalized.startsWith('http') ? direct : 'https://$direct';
      final uri = Uri.tryParse(withProtocol);
      if (uri == null) return null;
      final segments =
          uri.pathSegments.where((s) => s.trim().isNotEmpty).toList();
      if (segments.isEmpty) return null;

      if (segments.first == 'c' &&
          segments.length > 1 &&
          RegExp(r'^\d+$').hasMatch(segments[1])) {
        return '-100${segments[1]}';
      }

      final first = segments.first;
      if (RegExp(r'^[a-z0-9_]{4,}$', caseSensitive: false).hasMatch(first)) {
        return '@${first.toLowerCase()}';
      }
      return null;
    }

    if (RegExp(r'^[a-z0-9_]{4,}$', caseSensitive: false).hasMatch(raw)) {
      return '@${raw.toLowerCase()}';
    }

    return null;
  }

  List<String> _parseTelegramChatIdentifiers(String input) {
    if (input.trim().isEmpty) return <String>[];
    final tokens = input.split(RegExp(r'[\n,\s]+'));
    final parsed = tokens
        .map((token) => _parseTelegramChatIdentifier(token))
        .whereType<String>()
        .toList();
    return _uniqueIds(parsed);
  }

  String _toLocalDateTimeInput(String value) {
    final raw = value.trim();
    if (raw.isEmpty) return '';
    final date = DateTime.tryParse(raw);
    if (date == null) return '';
    String two(int n) => n.toString().padLeft(2, '0');
    return '${date.year}-${two(date.month)}-${two(date.day)}T${two(date.hour)}:${two(date.minute)}';
  }

  String _toDateInput(String value) {
    final raw = value.trim();
    if (raw.isEmpty) return '';
    final date = DateTime.tryParse(raw);
    if (date == null) return '';
    String two(int n) => n.toString().padLeft(2, '0');
    return '${date.year}-${two(date.month)}-${two(date.day)}';
  }

  String? _resolveYouTubeCategoryId(String value) {
    final raw = value.trim();
    if (raw.isEmpty) return null;

    for (final category in _kYouTubeCategories) {
      if (category['id'] == raw) return category['id'];
      if ((category['name'] ?? '').trim().toLowerCase() == raw.toLowerCase()) {
        return category['id'];
      }
    }

    final match = RegExp(r'\b(\d{1,3})\b').firstMatch(raw);
    if (match != null) {
      final candidate = match.group(1) ?? '';
      final exists =
          _kYouTubeCategories.any((category) => category['id'] == candidate);
      if (exists) return candidate;
    }

    return null;
  }

  List<String> _effectiveTelegramSourceChats() {
    return _uniqueIds([
      ..._telegramSourceChatIds,
      ..._parseTelegramChatIdentifiers(_sourceChatInputController.text),
    ]);
  }

  List<String> _effectiveTelegramTargetChats() {
    return _uniqueIds([
      ..._telegramTargetChatIds,
      ..._parseTelegramChatIdentifiers(_targetChatInputController.text),
    ]);
  }

  bool _telegramAccountHasChatId(Map<String, dynamic> account) {
    final credentials = account['credentials'];
    if (credentials is! Map<String, dynamic>) return false;
    final chatId = '${credentials['chatId'] ?? ''}'.trim();
    return chatId.isNotEmpty;
  }

  String? _validateStep(int step) {
    if (step == 1) {
      if (_nameController.text.trim().isEmpty) {
        return _t('Task name is required.', 'اسم المهمة مطلوب.');
      }
      return null;
    }

    if (step == 2) {
      if (_sourceAccountIds.isEmpty) {
        return _t('Select at least one source account.',
            'اختر حساب مصدر واحد على الأقل.');
      }
      final overlap = _sourceAccountIds.intersection(_targetAccountIds);
      if (overlap.isNotEmpty) {
        return _t(
          'A single account cannot be both source and target in the same task.',
          'لا يمكن أن يكون نفس الحساب مصدرًا وهدفًا في نفس المهمة.',
        );
      }
      return null;
    }

    if (step == 3) {
      if (_hasTwitterSource) {
        if (_twitterSourceType == 'username' &&
            _twitterUsernameController.text.trim().isEmpty) {
          return _t('Please enter a Twitter username for the source.',
              'يرجى إدخال اسم مستخدم تويتر للمصدر.');
        }
        if (_triggerType == 'on_like' && _twitterSourceType == 'username') {
          return _t(
            'Liked-tweet trigger requires a connected Twitter account.',
            'مشغّل الإعجاب يتطلب حساب تويتر متصل.',
          );
        }
        if ((_triggerType == 'on_keyword' ||
                _triggerType == 'on_hashtag' ||
                _triggerType == 'on_search') &&
            _triggerValueController.text.trim().isEmpty) {
          return _t(
            'Please enter a trigger value for the selected trigger type.',
            'يرجى إدخال قيمة المشغّل لنوع المشغّل المحدد.',
          );
        }
      }

      if (_hasTelegramSource) {
        final overrideIds = _effectiveTelegramSourceChats();
        final telegramAccounts = _selectedSourceAccounts
            .where((a) => (a['platformId']?.toString() ?? '') == 'telegram')
            .toList();
        final hasAccountChat = telegramAccounts.any(_telegramAccountHasChatId);

        if (overrideIds.isEmpty && !hasAccountChat) {
          return _t(
            'Telegram sources require at least one chat identifier (ID, @username, or t.me link).',
            'مصادر تيليجرام تتطلب معرف دردشة واحد على الأقل (ID أو @username أو رابط t.me).',
          );
        }
      }
      return null;
    }

    if (step == 4) {
      if (_targetAccountIds.isEmpty) {
        return _t('Select at least one destination account.',
            'اختر حساب هدف واحد على الأقل.');
      }
      final overlap = _sourceAccountIds.intersection(_targetAccountIds);
      if (overlap.isNotEmpty) {
        return _t(
          'A single account cannot be both source and target in the same task.',
          'لا يمكن أن يكون نفس الحساب مصدرًا وهدفًا في نفس المهمة.',
        );
      }
      return null;
    }

    if (step == 5) {
      if (_hasYouTubeTarget &&
          _ytUploadVideoToPlaylist &&
          _ytPlaylistId.trim().isEmpty) {
        return _t(
          'Please select a YouTube playlist or disable "Upload video to playlist".',
          'يرجى اختيار قائمة تشغيل يوتيوب أو تعطيل رفع الفيديو إلى قائمة تشغيل.',
        );
      }

      if (_hasTelegramTarget) {
        final overrideIds = _effectiveTelegramTargetChats();
        final telegramAccounts = _selectedTargetAccounts
            .where((a) => (a['platformId']?.toString() ?? '') == 'telegram')
            .toList();
        final hasAccountChat = telegramAccounts.any(_telegramAccountHasChatId);

        if (overrideIds.isEmpty && !hasAccountChat) {
          return _t(
            'Telegram targets require at least one chat identifier (ID, @username, or t.me link).',
            'أهداف تيليجرام تتطلب معرف دردشة واحدًا على الأقل (ID أو @username أو رابط t.me).',
          );
        }
      }

      return null;
    }

    return null;
  }

  Map<String, dynamic> _buildRequestBody() {
    final filtersPayload = <String, dynamic>{};

    final sourceTelegramChatIds = _effectiveTelegramSourceChats();
    final targetTelegramChatIds = _effectiveTelegramTargetChats();

    if (_hasTwitterSource) {
      filtersPayload['twitterSourceType'] = _twitterSourceType;
      if (_twitterUsernameController.text.trim().isNotEmpty) {
        filtersPayload['twitterUsername'] =
            _twitterUsernameController.text.trim();
      }
      filtersPayload['excludeReplies'] = _excludeReplies;
      filtersPayload['excludeRetweets'] = _excludeRetweets;
      filtersPayload['excludeQuotes'] = _excludeQuotes;
      filtersPayload['originalOnly'] = _originalOnly;
      filtersPayload['pollIntervalSeconds'] = _pollIntervalSeconds;
      filtersPayload['triggerType'] = _triggerType;
      if (_triggerValueController.text.trim().isNotEmpty) {
        filtersPayload['triggerValue'] = _triggerValueController.text.trim();
      }
    }

    if (_hasTelegramSource) {
      if (sourceTelegramChatIds.isNotEmpty) {
        filtersPayload['telegramChatId'] = sourceTelegramChatIds.first;
        filtersPayload['telegramChatIds'] = sourceTelegramChatIds;
      }
    }

    final tags = _ytTagsController.text
        .split(RegExp(r'[\n,]'))
        .map((v) => v.trim())
        .where((v) => v.isNotEmpty)
        .toList();

    final youtubeVideo = <String, dynamic>{
      'privacyStatus': _ytPrivacyStatus,
      'categoryId': _resolveYouTubeCategoryId(_ytCategoryId) ??
          _kDefaultYouTubeCategoryId,
      'embeddable': _ytEmbeddable,
      'license': _ytLicense,
      'publicStatsViewable': _ytPublicStatsViewable,
      'selfDeclaredMadeForKids': _ytMadeForKids,
      'notifySubscribers': _ytNotifySubscribers,
      'tags': tags,
    };

    if (_ytTitleTemplateController.text.trim().isNotEmpty) {
      youtubeVideo['titleTemplate'] = _ytTitleTemplateController.text.trim();
    }
    if (_ytDescriptionTemplateController.text.trim().isNotEmpty) {
      youtubeVideo['descriptionTemplate'] =
          _ytDescriptionTemplateController.text.trim();
    }

    final publishAt = DateTime.tryParse(_ytPublishAtController.text.trim());
    if (publishAt != null) {
      youtubeVideo['publishAt'] = publishAt.toIso8601String();
    }

    if (_ytDefaultLanguageController.text.trim().isNotEmpty) {
      youtubeVideo['defaultLanguage'] =
          _ytDefaultLanguageController.text.trim();
    }
    if (_ytDefaultAudioLanguageController.text.trim().isNotEmpty) {
      youtubeVideo['defaultAudioLanguage'] =
          _ytDefaultAudioLanguageController.text.trim();
    }

    final recordingRaw = _ytRecordingDateController.text.trim();
    if (recordingRaw.isNotEmpty) {
      final recording = DateTime.tryParse('${recordingRaw}T00:00:00.000Z');
      if (recording != null) {
        youtubeVideo['recordingDate'] = recording.toIso8601String();
      }
    }

    final transformations = <String, dynamic>{
      'includeMedia': _includeMedia,
      'enableYtDlp': _enableYtDlp,
      'twitterActions': <String, dynamic>{
        'post': _twitterActions['post'] == true,
        'reply': _twitterActions['reply'] == true,
        'quote': _twitterActions['quote'] == true,
        'retweet': _twitterActions['retweet'] == true,
        'like': _twitterActions['like'] == true,
      },
      'youtubeActions': <String, dynamic>{
        'uploadVideo': _ytUploadVideo,
        'uploadVideoToPlaylist': _ytUploadVideoToPlaylist,
        if (_ytUploadVideoToPlaylist && _ytPlaylistId.trim().isNotEmpty)
          'playlistId': _ytPlaylistId.trim(),
      },
      'youtubeVideo': youtubeVideo,
    };

    if (_templateController.text.trim().isNotEmpty) {
      transformations['template'] = _templateController.text.trim();
    }

    if (_hasTelegramTarget && targetTelegramChatIds.isNotEmpty) {
      transformations['telegramTargetChatId'] = targetTelegramChatIds.first;
      transformations['telegramTargetChatIds'] = targetTelegramChatIds;
    }

    final body = <String, dynamic>{
      'name': _nameController.text.trim(),
      'description': _descController.text.trim(),
      'sourceAccounts': _sourceAccountIds.toList(),
      'targetAccounts': _targetAccountIds.toList(),
      'contentType': 'text',
      'executionType': 'immediate',
      'transformations': transformations,
    };

    if (filtersPayload.isNotEmpty) {
      body['filters'] = filtersPayload;
    }

    return body;
  }

  Future<bool> _saveEdit({bool notify = false}) async {
    final id = _taskId.trim();
    if (id.isEmpty) return false;

    setState(() => _busy = true);
    try {
      final body = _buildRequestBody();
      await widget.api.updateTask(widget.accessToken, id, body: body);
      if (notify) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(_t('Task saved.', 'تم حفظ المهمة.')),
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
      return true;
    } catch (error) {
      _setError(
        error is ApiException
            ? error.message
            : _t('Failed to save task.', 'فشل حفظ المهمة.'),
        toast: true,
      );
      return false;
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _createTask() async {
    setState(() => _busy = true);
    try {
      final body = _buildRequestBody();
      body['status'] = 'active';

      final response =
          await widget.api.createTask(widget.accessToken, body: body);
      await _clearDraft();

      if (!mounted) return;
      final duplicate = response['duplicate'] == true;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            duplicate
                ? _t('Task already exists and was reused.',
                    'المهمة موجودة مسبقًا وتمت إعادة استخدامها.')
                : _t('Task created successfully.', 'تم إنشاء المهمة بنجاح.'),
          ),
          behavior: SnackBarBehavior.floating,
        ),
      );
      Navigator.of(context).pop(true);
    } catch (error) {
      _setError(
        error is ApiException
            ? error.message
            : _t('Failed to create task.', 'فشل إنشاء المهمة.'),
        toast: true,
      );
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _handleNext() async {
    final error = _validateStep(_step);
    if (error != null) {
      _setError(error, toast: true);
      return;
    }

    if (_isEdit) {
      final ok = await _saveEdit();
      if (!ok) return;
    }

    setState(() => _step = (_step + 1).clamp(1, 5));
    _persistDraftSoon();
  }

  Future<void> _handleBack() async {
    if (_step == 1) return;

    if (_isEdit) {
      final ok = await _saveEdit();
      if (!ok) return;
    }

    setState(() => _step = (_step - 1).clamp(1, 5));
    _persistDraftSoon();
  }

  Future<void> _jumpToStep(int targetStep) async {
    if (targetStep == _step) return;

    if (targetStep > _step) {
      for (int s = _step; s < targetStep; s++) {
        final error = _validateStep(s);
        if (error != null) {
          _setError(error, toast: true);
          return;
        }
      }
    }

    if (_isEdit) {
      final ok = await _saveEdit();
      if (!ok) return;
    }

    setState(() => _step = targetStep.clamp(1, 5));
  }

  void _toggleSourceAccount(String accountId) {
    final selected = _sourceAccountIds.contains(accountId);
    if (!selected && _targetAccountIds.contains(accountId)) {
      _setError(
        _t(
          'This account is already selected as a target. Remove it from targets first.',
          'هذا الحساب محدد كهدف بالفعل. قم بإزالته من الأهداف أولاً.',
        ),
        toast: true,
      );
      return;
    }

    setState(() {
      if (selected) {
        _sourceAccountIds.remove(accountId);
      } else {
        _sourceAccountIds.add(accountId);
      }
      _error = '';
    });
    _persistDraftSoon();
  }

  void _toggleTargetAccount(String accountId) {
    final selected = _targetAccountIds.contains(accountId);
    if (!selected && _sourceAccountIds.contains(accountId)) {
      _setError(
        _t(
          'This account is already selected as a source. Remove it from sources first.',
          'هذا الحساب محدد كمصدر بالفعل. قم بإزالته من المصادر أولاً.',
        ),
        toast: true,
      );
      return;
    }

    setState(() {
      if (selected) {
        _targetAccountIds.remove(accountId);
      } else {
        _targetAccountIds.add(accountId);
      }
      _error = '';
    });
    _persistDraftSoon();
  }

  bool _addTelegramChatTag({required bool source, required String raw}) {
    final parsed = _parseTelegramChatIdentifier(raw);
    if (parsed == null) {
      _setError(
        _t(
          'Invalid Telegram identifier. Use ID, @username, or t.me link.',
          'معرف تيليجرام غير صالح. استخدم ID أو @username أو رابط t.me.',
        ),
        toast: true,
      );
      return false;
    }

    setState(() {
      if (source) {
        final next = _uniqueIds(<String>[..._telegramSourceChatIds, parsed]);
        _telegramSourceChatIds
          ..clear()
          ..addAll(next);
      } else {
        final next = _uniqueIds(<String>[..._telegramTargetChatIds, parsed]);
        _telegramTargetChatIds
          ..clear()
          ..addAll(next);
      }
      _error = '';
    });

    _persistDraftSoon();
    return true;
  }

  void _removeTelegramChatTag({required bool source, required String value}) {
    setState(() {
      if (source) {
        _telegramSourceChatIds.remove(value);
      } else {
        _telegramTargetChatIds.remove(value);
      }
      _error = '';
    });

    _persistDraftSoon();
  }

  Widget _buildStepperCard() {
    final items = <Map<String, dynamic>>[
      <String, dynamic>{'step': 1, 'title': _t('Task Info', 'معلومات المهمة')},
      <String, dynamic>{'step': 2, 'title': _t('Source', 'المصدر')},
      <String, dynamic>{
        'step': 3,
        'title': _t('Source Settings', 'إعدادات المصدر')
      },
      <String, dynamic>{'step': 4, 'title': _t('Target', 'الهدف')},
      <String, dynamic>{
        'step': 5,
        'title': _t('Target Settings', 'إعدادات الهدف')
      },
    ];

    int done = 0;
    for (final item in items) {
      final step = item['step'] as int;
      if (_validateStep(step) == null) done += 1;
    }
    final progress = ((done / items.length) * 100).round();

    return SfPanelCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  _isEdit
                      ? _t('Edit Task Wizard', 'معالج تعديل المهمة')
                      : _t('Create Task Wizard', 'معالج إنشاء مهمة'),
                  style: const TextStyle(
                      fontSize: 18, fontWeight: FontWeight.w900),
                ),
              ),
              Text(
                _t('Step $_step/5', 'الخطوة $_step/5'),
                style: TextStyle(
                    color: Theme.of(context).colorScheme.onSurfaceVariant),
              ),
            ],
          ),
          const SizedBox(height: 10),
          ClipRRect(
            borderRadius: BorderRadius.circular(999),
            child: LinearProgressIndicator(
              minHeight: 8,
              value: progress / 100,
              backgroundColor:
                  Theme.of(context).colorScheme.surfaceContainerHighest,
            ),
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: items.map((item) {
              final s = item['step'] as int;
              final title = item['title'] as String;
              final missing = _validateStep(s) != null;
              final active = s == _step;

              return InkWell(
                borderRadius: BorderRadius.circular(999),
                onTap: _busy ? null : () => unawaited(_jumpToStep(s)),
                child: Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(999),
                    color: active
                        ? Theme.of(context).colorScheme.primary.withAlpha(28)
                        : Theme.of(context).colorScheme.surface.withAlpha(120),
                    border: Border.all(
                      color: active
                          ? Theme.of(context).colorScheme.primary.withAlpha(100)
                          : Theme.of(context).colorScheme.outline.withAlpha(70),
                    ),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        '$s',
                        style: TextStyle(
                          fontWeight: FontWeight.w900,
                          color: active
                              ? Theme.of(context).colorScheme.primary
                              : Theme.of(context).colorScheme.onSurface,
                        ),
                      ),
                      const SizedBox(width: 6),
                      Text(
                        title,
                        style: const TextStyle(fontWeight: FontWeight.w700),
                      ),
                      if (missing) ...[
                        const SizedBox(width: 6),
                        Icon(Icons.error_outline_rounded,
                            size: 14,
                            color: Theme.of(context).colorScheme.error),
                      ],
                    ],
                  ),
                ),
              );
            }).toList(),
          ),
        ],
      ),
    );
  }

  Widget _buildAccountSelectionStep({required bool source}) {
    final selectedIds = source ? _sourceAccountIds : _targetAccountIds;
    final groups = _groupedCandidates(source: source);
    final busy = _busy;

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(
          flex: 7,
          child: SfPanelCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Icon(source ? Icons.input_rounded : Icons.output_rounded),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        source
                            ? _t('Source Account(s) *', 'حسابات المصدر *')
                            : _t('Target Account(s) *', 'حسابات الهدف *'),
                        style: const TextStyle(
                            fontSize: 16, fontWeight: FontWeight.w900),
                      ),
                    ),
                    Text(
                      '${selectedIds.length}',
                      style: const TextStyle(fontWeight: FontWeight.w900),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                TextField(
                  controller: source
                      ? _sourceSearchController
                      : _targetSearchController,
                  onChanged: (_) => _onFormChanged(),
                  decoration: InputDecoration(
                    prefixIcon: const Icon(Icons.search_rounded),
                    hintText: source
                        ? _t('Search source accounts...',
                            'ابحث في حسابات المصدر...')
                        : _t('Search target accounts...',
                            'ابحث في حسابات الهدف...'),
                  ),
                ),
                const SizedBox(height: 10),
                if (_loadingAccounts)
                  const Padding(
                    padding: EdgeInsets.all(20),
                    child: Center(child: CircularProgressIndicator()),
                  )
                else if (_accounts.isEmpty)
                  Text(
                    _t('No accounts available.', 'لا توجد حسابات متاحة.'),
                    style: TextStyle(
                        color: Theme.of(context).colorScheme.onSurfaceVariant),
                  )
                else if (groups.isEmpty)
                  Text(
                    _t('No accounts match your search.',
                        'لا توجد حسابات تطابق البحث.'),
                    style: TextStyle(
                        color: Theme.of(context).colorScheme.onSurfaceVariant),
                  )
                else
                  ...groups.map((entry) {
                    final platform = entry.key;
                    final accounts = entry.value;

                    return Container(
                      margin: const EdgeInsets.only(bottom: 10),
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(
                            color: Theme.of(context)
                                .colorScheme
                                .outline
                                .withAlpha(60)),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Container(
                            width: double.infinity,
                            padding: const EdgeInsets.symmetric(
                                horizontal: 12, vertical: 8),
                            decoration: BoxDecoration(
                              color: Theme.of(context)
                                  .colorScheme
                                  .surface
                                  .withAlpha(115),
                              borderRadius: const BorderRadius.vertical(
                                  top: Radius.circular(13)),
                            ),
                            child: Row(
                              children: [
                                Icon(_platformIcon(platform),
                                    size: 16, color: _platformColor(platform)),
                                const SizedBox(width: 8),
                                Expanded(
                                  child: Text(
                                    _platformLabel(platform),
                                    style: const TextStyle(
                                        fontWeight: FontWeight.w800),
                                  ),
                                ),
                                Text(
                                  '${accounts.where((a) => selectedIds.contains('${a['id']}')).length}/${accounts.length}',
                                  style: TextStyle(
                                    fontSize: 12,
                                    color: Theme.of(context)
                                        .colorScheme
                                        .onSurfaceVariant,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          ...accounts.map((account) {
                            final id = '${account['id']}';
                            final selected = selectedIds.contains(id);
                            final conflict = source
                                ? _targetAccountIds.contains(id)
                                : _sourceAccountIds.contains(id);

                            return CheckboxListTile(
                              dense: true,
                              contentPadding:
                                  const EdgeInsets.symmetric(horizontal: 8),
                              value: selected,
                              onChanged: busy
                                  ? null
                                  : (_) {
                                      if (source) {
                                        _toggleSourceAccount(id);
                                      } else {
                                        _toggleTargetAccount(id);
                                      }
                                    },
                              secondary: Icon(
                                _platformIcon('${account['platformId'] ?? ''}'),
                                color: _platformColor(
                                    '${account['platformId'] ?? ''}'),
                              ),
                              title: Text(_accountLabel(account),
                                  overflow: TextOverflow.ellipsis),
                              subtitle: Text(
                                '${account['platformId']} • @${account['accountUsername'] ?? '-'}${conflict && !selected ? (source ? ' • target' : ' • source') : ''}',
                                overflow: TextOverflow.ellipsis,
                              ),
                            );
                          }),
                        ],
                      ),
                    );
                  }),
              ],
            ),
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          flex: 5,
          child: SfPanelCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  source
                      ? _t('What counts as a source?', 'ما هو المصدر؟')
                      : _t('What counts as a target?', 'ما هو الهدف؟'),
                  style: const TextStyle(
                      fontSize: 16, fontWeight: FontWeight.w900),
                ),
                const SizedBox(height: 8),
                Text(
                  source
                      ? _t(
                          'Sources are the accounts that trigger or provide content (polling / stream / webhook).',
                          'المصادر هي الحسابات التي تشغّل الحدث أو توفر المحتوى (Polling / Stream / Webhook).',
                        )
                      : _t(
                          'Targets are the accounts where content is published or actions are executed.',
                          'الأهداف هي الحسابات التي سيتم النشر إليها أو تنفيذ الإجراءات عليها.',
                        ),
                  style: TextStyle(
                      color: Theme.of(context).colorScheme.onSurfaceVariant),
                ),
                const SizedBox(height: 10),
                Text(
                  _t(
                    'The same account cannot be selected on both sides in one task.',
                    'لا يمكن اختيار نفس الحساب كمصدر وهدف في نفس المهمة.',
                  ),
                  style: TextStyle(
                    fontWeight: FontWeight.w700,
                    color: Theme.of(context).colorScheme.onSurfaceVariant,
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildTwitterSourceSettings() {
    return SfPanelCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            _t('Twitter / X Source Settings', 'إعدادات مصدر تويتر / X'),
            style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w900),
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: DropdownButtonFormField<String>(
                  initialValue: _twitterSourceType,
                  decoration: InputDecoration(
                    labelText: _t('Source Type', 'نوع المصدر'),
                    prefixIcon: const Icon(Icons.source_rounded),
                  ),
                  items: [
                    DropdownMenuItem(
                      value: 'account',
                      child: Text(_t('Connected Account', 'حساب متصل')),
                    ),
                    DropdownMenuItem(
                      value: 'username',
                      child: Text(_t('Username', 'اسم مستخدم')),
                    ),
                  ],
                  onChanged: _busy
                      ? null
                      : (value) {
                          if (value == null) return;
                          setState(() => _twitterSourceType = value);
                          _persistDraftSoon();
                        },
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: TextField(
                  controller: _twitterUsernameController,
                  enabled: _twitterSourceType == 'username' && !_busy,
                  onChanged: (_) => _onFormChanged(),
                  decoration: InputDecoration(
                    labelText: _t('Twitter Username', 'اسم مستخدم تويتر'),
                    hintText: _t('without @', 'بدون @'),
                    prefixIcon: const Icon(Icons.alternate_email_rounded),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              _switchChip(
                label: _t('Exclude replies', 'استبعاد الردود'),
                value: _excludeReplies,
                onChanged: (v) {
                  setState(() => _excludeReplies = v);
                  _persistDraftSoon();
                },
              ),
              _switchChip(
                label: _t('Exclude retweets', 'استبعاد إعادة التغريد'),
                value: _excludeRetweets,
                onChanged: (v) {
                  setState(() => _excludeRetweets = v);
                  _persistDraftSoon();
                },
              ),
              _switchChip(
                label: _t('Exclude quotes', 'استبعاد الاقتباسات'),
                value: _excludeQuotes,
                onChanged: (v) {
                  setState(() => _excludeQuotes = v);
                  _persistDraftSoon();
                },
              ),
              _switchChip(
                label: _t('Original only', 'الأصلية فقط'),
                value: _originalOnly,
                onChanged: (v) {
                  setState(() => _originalOnly = v);
                  _persistDraftSoon();
                },
              ),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: DropdownButtonFormField<String>(
                  initialValue: _triggerType,
                  decoration: InputDecoration(
                    labelText: _t('Trigger Type', 'نوع المشغّل'),
                    prefixIcon: const Icon(Icons.bolt_rounded),
                  ),
                  items: _kTwitterTriggerTypes
                      .map((item) => DropdownMenuItem(
                            value: item,
                            child: Text(item),
                          ))
                      .toList(),
                  onChanged: _busy
                      ? null
                      : (value) {
                          if (value == null) return;
                          setState(() => _triggerType = value);
                          _persistDraftSoon();
                        },
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: TextFormField(
                  initialValue: '$_pollIntervalSeconds',
                  keyboardType: TextInputType.number,
                  decoration: InputDecoration(
                    labelText:
                        _t('Poll Interval (seconds)', 'فاصل الاستطلاع (ثانية)'),
                    prefixIcon: const Icon(Icons.schedule_rounded),
                  ),
                  onChanged: (value) {
                    final parsed = int.tryParse(value) ?? 60;
                    setState(
                        () => _pollIntervalSeconds = parsed < 10 ? 10 : parsed);
                    _persistDraftSoon();
                  },
                ),
              ),
            ],
          ),
          if (_triggerType == 'on_keyword' ||
              _triggerType == 'on_hashtag' ||
              _triggerType == 'on_search') ...[
            const SizedBox(height: 10),
            TextField(
              controller: _triggerValueController,
              onChanged: (_) => _onFormChanged(),
              decoration: InputDecoration(
                labelText: _t('Trigger Value', 'قيمة المشغّل'),
                hintText: _t('keyword, #hashtag, or search query',
                    'كلمة أو #وسم أو استعلام بحث'),
                prefixIcon: const Icon(Icons.search_rounded),
              ),
            ),
          ],
          const SizedBox(height: 8),
          Text(
            _t('Applies to all selected Twitter source accounts.',
                'تُطبق على جميع حسابات المصدر تويتر المحددة.'),
            style: TextStyle(
                color: Theme.of(context).colorScheme.onSurfaceVariant,
                fontSize: 12),
          ),
        ],
      ),
    );
  }

  Widget _buildTelegramSourceSettings() {
    final telegramAccounts = _selectedSourceAccounts
        .where((a) => (a['platformId']?.toString() ?? '') == 'telegram')
        .toList();
    final anyAccountHasChat = telegramAccounts.any(_telegramAccountHasChatId);

    return SfPanelCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            _t('Telegram Source Settings', 'إعدادات مصدر تيليجرام'),
            style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w900),
          ),
          const SizedBox(height: 8),
          ...telegramAccounts.map((account) {
            final chatId = account['credentials'] is Map<String, dynamic>
                ? '${(account['credentials'] as Map<String, dynamic>)['chatId'] ?? ''}'
                    .trim()
                : '';
            return Container(
              margin: const EdgeInsets.only(bottom: 6),
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(10),
                color: Theme.of(context).colorScheme.surface.withAlpha(90),
                border: Border.all(
                    color: Theme.of(context).colorScheme.outline.withAlpha(60)),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      _accountLabel(account),
                      style: const TextStyle(fontWeight: FontWeight.w700),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  Text(
                    chatId.isEmpty ? 'chatId: not set' : 'chatId: $chatId',
                    style: TextStyle(
                      fontSize: 12,
                      color: Theme.of(context).colorScheme.onSurfaceVariant,
                    ),
                  ),
                ],
              ),
            );
          }),
          const SizedBox(height: 8),
          Text(
            _t('Telegram source chats (ID, @username, or link)',
                'دردشات مصدر تيليجرام (ID أو @username أو رابط)'),
            style: const TextStyle(fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 6),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: _telegramSourceChatIds
                .map((id) => InputChip(
                      label: Text(id),
                      onDeleted: _busy
                          ? null
                          : () =>
                              _removeTelegramChatTag(source: true, value: id),
                    ))
                .toList(),
          ),
          const SizedBox(height: 6),
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _sourceChatInputController,
                  onChanged: (_) => _onFormChanged(),
                  onSubmitted: _busy
                      ? null
                      : (value) {
                          if (_addTelegramChatTag(source: true, raw: value)) {
                            _sourceChatInputController.clear();
                          }
                        },
                  decoration: InputDecoration(
                    hintText:
                        _t('Type value then Enter', 'اكتب القيمة ثم Enter'),
                    prefixIcon: const Icon(Icons.tag_rounded),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              FilledButton.icon(
                onPressed: _busy
                    ? null
                    : () {
                        if (_addTelegramChatTag(
                            source: true,
                            raw: _sourceChatInputController.text)) {
                          _sourceChatInputController.clear();
                        }
                      },
                icon: const Icon(Icons.add_rounded),
                label: Text(_t('Add', 'إضافة')),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            anyAccountHasChat
                ? _t(
                    'Optional override. Account chatId is still used when available.',
                    'تجاوز اختياري. سيتم استخدام chatId الخاص بالحساب عند توفره.',
                  )
                : _t(
                    'Add at least one source chat when account chatId is missing.',
                    'أضف دردشة مصدر واحدة على الأقل عند عدم توفر chatId في الحساب.',
                  ),
            style: TextStyle(
                fontSize: 12,
                color: Theme.of(context).colorScheme.onSurfaceVariant),
          ),
        ],
      ),
    );
  }

  Widget _buildSourceSettingsStep() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SfPanelCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                _t('General Transformations', 'تحويلات عامة'),
                style:
                    const TextStyle(fontSize: 16, fontWeight: FontWeight.w900),
              ),
              const SizedBox(height: 10),
              TextField(
                controller: _templateController,
                onChanged: (_) => _onFormChanged(),
                decoration: InputDecoration(
                  labelText: _t('Template (optional)', 'قالب (اختياري)'),
                  hintText: _t('Use placeholders like %text%',
                      'استخدم عناصر مثل %text%'),
                  prefixIcon: const Icon(Icons.text_fields_rounded),
                ),
              ),
              const SizedBox(height: 8),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  _switchChip(
                    label: _t('Include media', 'تضمين الوسائط'),
                    value: _includeMedia,
                    onChanged: (v) {
                      setState(() => _includeMedia = v);
                      _persistDraftSoon();
                    },
                  ),
                  _switchChip(
                    label: _t('Enable yt-dlp', 'تفعيل yt-dlp'),
                    value: _enableYtDlp,
                    onChanged: (v) {
                      setState(() => _enableYtDlp = v);
                      _persistDraftSoon();
                    },
                  ),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: 10),
        ..._sourcePlatforms.map((platform) {
          if (platform == 'twitter' && _hasTwitterSource) {
            return Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: _buildTwitterSourceSettings(),
            );
          }
          if (platform == 'telegram' && _hasTelegramSource) {
            return Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: _buildTelegramSourceSettings(),
            );
          }
          return Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: SfPanelCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    '${_platformLabel(platform)} ${_t('Source Settings', 'إعدادات المصدر')}',
                    style: const TextStyle(
                        fontSize: 16, fontWeight: FontWeight.w900),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    _t('Reserved source settings for this platform.',
                        'إعدادات المصدر لهذا النظام الأساسي محفوظة حالياً.'),
                    style: TextStyle(
                        color: Theme.of(context).colorScheme.onSurfaceVariant),
                  ),
                ],
              ),
            ),
          );
        }),
        if (_sourcePlatforms.isEmpty)
          SfPanelCard(
            child: Text(
              _t('Select at least one source to configure settings.',
                  'اختر مصدرًا واحدًا على الأقل لضبط الإعدادات.'),
              style: TextStyle(
                  color: Theme.of(context).colorScheme.onSurfaceVariant),
            ),
          ),
      ],
    );
  }

  Widget _buildTelegramTargetSettings() {
    final telegramAccounts = _selectedTargetAccounts
        .where((a) => (a['platformId']?.toString() ?? '') == 'telegram')
        .toList();
    final anyAccountHasChat = telegramAccounts.any(_telegramAccountHasChatId);

    return SfPanelCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            _t('Telegram Target Settings', 'إعدادات هدف تيليجرام'),
            style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w900),
          ),
          const SizedBox(height: 8),
          ...telegramAccounts.map((account) {
            final chatId = account['credentials'] is Map<String, dynamic>
                ? '${(account['credentials'] as Map<String, dynamic>)['chatId'] ?? ''}'
                    .trim()
                : '';
            return Container(
              margin: const EdgeInsets.only(bottom: 6),
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(10),
                color: Theme.of(context).colorScheme.surface.withAlpha(90),
                border: Border.all(
                    color: Theme.of(context).colorScheme.outline.withAlpha(60)),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      _accountLabel(account),
                      style: const TextStyle(fontWeight: FontWeight.w700),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  Text(
                    chatId.isEmpty ? 'chatId: not set' : 'chatId: $chatId',
                    style: TextStyle(
                      fontSize: 12,
                      color: Theme.of(context).colorScheme.onSurfaceVariant,
                    ),
                  ),
                ],
              ),
            );
          }),
          const SizedBox(height: 8),
          Text(
            _t('Telegram target chats (ID, @username, or link)',
                'دردشات هدف تيليجرام (ID أو @username أو رابط)'),
            style: const TextStyle(fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 6),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: _telegramTargetChatIds
                .map((id) => InputChip(
                      label: Text(id),
                      onDeleted: _busy
                          ? null
                          : () =>
                              _removeTelegramChatTag(source: false, value: id),
                    ))
                .toList(),
          ),
          const SizedBox(height: 6),
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _targetChatInputController,
                  onChanged: (_) => _onFormChanged(),
                  onSubmitted: _busy
                      ? null
                      : (value) {
                          if (_addTelegramChatTag(source: false, raw: value)) {
                            _targetChatInputController.clear();
                          }
                        },
                  decoration: InputDecoration(
                    hintText:
                        _t('Type value then Enter', 'اكتب القيمة ثم Enter'),
                    prefixIcon: const Icon(Icons.tag_rounded),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              FilledButton.icon(
                onPressed: _busy
                    ? null
                    : () {
                        if (_addTelegramChatTag(
                            source: false,
                            raw: _targetChatInputController.text)) {
                          _targetChatInputController.clear();
                        }
                      },
                icon: const Icon(Icons.add_rounded),
                label: Text(_t('Add', 'إضافة')),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            anyAccountHasChat
                ? _t(
                    'Optional override/fallback for Telegram destination chat IDs.',
                    'تجاوز اختياري/بديل لمعرفات دردشة تيليجرام الهدف.',
                  )
                : _t(
                    'Add at least one target chat when no account chatId is saved.',
                    'أضف دردشة هدف واحدة على الأقل عند عدم توفر chatId بالحساب.',
                  ),
            style: TextStyle(
                fontSize: 12,
                color: Theme.of(context).colorScheme.onSurfaceVariant),
          ),
        ],
      ),
    );
  }

  Widget _buildTwitterTargetSettings() {
    return SfPanelCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            _t('Twitter / X Target Settings', 'إعدادات هدف تويتر / X'),
            style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w900),
          ),
          const SizedBox(height: 10),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: ['post', 'reply', 'quote', 'retweet', 'like']
                .map((action) => _switchChip(
                      label: action,
                      value: _twitterActions[action] == true,
                      onChanged: (value) {
                        setState(() => _twitterActions[action] = value);
                        _persistDraftSoon();
                      },
                    ))
                .toList(),
          ),
          const SizedBox(height: 8),
          Text(
            _t('Applies to all selected Twitter targets.',
                'تُطبق على جميع أهداف تويتر المحددة.'),
            style: TextStyle(
                fontSize: 12,
                color: Theme.of(context).colorScheme.onSurfaceVariant),
          ),
        ],
      ),
    );
  }

  Widget _buildYouTubeTargetSettings() {
    final playlists = _youtubePlaylists;

    return SfPanelCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            _t('YouTube Target Settings', 'إعدادات هدف يوتيوب'),
            style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w900),
          ),
          const SizedBox(height: 10),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              _switchChip(
                label: _t('Upload video', 'رفع فيديو'),
                value: _ytUploadVideo,
                onChanged: (v) {
                  setState(() => _ytUploadVideo = v);
                  _persistDraftSoon();
                },
              ),
              _switchChip(
                label: _t('Upload to playlist', 'رفع إلى قائمة تشغيل'),
                value: _ytUploadVideoToPlaylist,
                onChanged: (v) {
                  setState(() {
                    _ytUploadVideoToPlaylist = v;
                    if (!v) _ytPlaylistId = '';
                  });
                  _persistDraftSoon();
                },
              ),
            ],
          ),
          if (_ytUploadVideoToPlaylist) ...[
            const SizedBox(height: 10),
            DropdownButtonFormField<String>(
              initialValue: _ytPlaylistId.isEmpty ? null : _ytPlaylistId,
              decoration: InputDecoration(
                labelText: _t('Playlist', 'قائمة التشغيل'),
                prefixIcon: const Icon(Icons.queue_music_rounded),
              ),
              items: playlists
                  .map((p) => DropdownMenuItem<String>(
                        value: p['id'],
                        child: Text(p['title'] ?? p['id'] ?? ''),
                      ))
                  .toList(),
              onChanged: _busy
                  ? null
                  : (value) {
                      setState(() => _ytPlaylistId = value ?? '');
                      _persistDraftSoon();
                    },
            ),
            if (playlists.isEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 6),
                child: Text(
                  _t('No playlists found on selected YouTube account(s).',
                      'لا توجد قوائم تشغيل في حسابات يوتيوب المحددة.'),
                  style: TextStyle(
                      fontSize: 12,
                      color: Theme.of(context).colorScheme.onSurfaceVariant),
                ),
              ),
          ],
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _ytTitleTemplateController,
                  onChanged: (_) => _onFormChanged(),
                  decoration: InputDecoration(
                    labelText: _t('Video Title Template', 'قالب عنوان الفيديو'),
                    hintText: '%text%',
                    prefixIcon: const Icon(Icons.title_rounded),
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: TextField(
                  controller: _ytTagsController,
                  onChanged: (_) => _onFormChanged(),
                  decoration: InputDecoration(
                    labelText: _t('Tags', 'الوسوم'),
                    hintText: _t('comma/new line', 'بفاصلة/سطر جديد'),
                    prefixIcon: const Icon(Icons.sell_rounded),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          TextField(
            controller: _ytDescriptionTemplateController,
            onChanged: (_) => _onFormChanged(),
            minLines: 2,
            maxLines: 4,
            decoration: InputDecoration(
              labelText: _t('Video Description Template', 'قالب وصف الفيديو'),
              hintText: '%text%\n\n%link%',
              prefixIcon: const Icon(Icons.notes_rounded),
            ),
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: DropdownButtonFormField<String>(
                  initialValue: _ytPrivacyStatus,
                  decoration: InputDecoration(
                    labelText: _t('Privacy', 'الخصوصية'),
                    prefixIcon: const Icon(Icons.visibility_rounded),
                  ),
                  items: const [
                    DropdownMenuItem(value: 'public', child: Text('public')),
                    DropdownMenuItem(
                        value: 'unlisted', child: Text('unlisted')),
                    DropdownMenuItem(value: 'private', child: Text('private')),
                  ],
                  onChanged: _busy
                      ? null
                      : (value) {
                          if (value == null) return;
                          setState(() => _ytPrivacyStatus = value);
                          _persistDraftSoon();
                        },
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: DropdownButtonFormField<String>(
                  initialValue: _ytCategoryId,
                  decoration: InputDecoration(
                    labelText: _t('Category', 'الفئة'),
                    prefixIcon: const Icon(Icons.category_rounded),
                  ),
                  items: _kYouTubeCategories
                      .map((item) => DropdownMenuItem<String>(
                            value: item['id'],
                            child: Text('${item['id']} - ${item['name']}'),
                          ))
                      .toList(),
                  onChanged: _busy
                      ? null
                      : (value) {
                          if (value == null) return;
                          setState(() => _ytCategoryId = value);
                          _persistDraftSoon();
                        },
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              _switchChip(
                label: _t('Embeddable', 'قابل للتضمين'),
                value: _ytEmbeddable,
                onChanged: (v) {
                  setState(() => _ytEmbeddable = v);
                  _persistDraftSoon();
                },
              ),
              _switchChip(
                label: _t('Public stats viewable', 'إحصاءات عامة مرئية'),
                value: _ytPublicStatsViewable,
                onChanged: (v) {
                  setState(() => _ytPublicStatsViewable = v);
                  _persistDraftSoon();
                },
              ),
              _switchChip(
                label: _t('Made for kids', 'محتوى للأطفال'),
                value: _ytMadeForKids,
                onChanged: (v) {
                  setState(() => _ytMadeForKids = v);
                  _persistDraftSoon();
                },
              ),
              _switchChip(
                label: _t('Notify subscribers', 'إشعار المشتركين'),
                value: _ytNotifySubscribers,
                onChanged: (v) {
                  setState(() => _ytNotifySubscribers = v);
                  _persistDraftSoon();
                },
              ),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: DropdownButtonFormField<String>(
                  initialValue: _ytLicense,
                  decoration: InputDecoration(
                    labelText: _t('License', 'الترخيص'),
                    prefixIcon: const Icon(Icons.gavel_rounded),
                  ),
                  items: const [
                    DropdownMenuItem(value: 'youtube', child: Text('youtube')),
                    DropdownMenuItem(
                        value: 'creativeCommon', child: Text('creativeCommon')),
                  ],
                  onChanged: _busy
                      ? null
                      : (value) {
                          if (value == null) return;
                          setState(() => _ytLicense = value);
                          _persistDraftSoon();
                        },
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: TextField(
                  controller: _ytPublishAtController,
                  onChanged: (_) => _onFormChanged(),
                  decoration: InputDecoration(
                    labelText:
                        _t('Publish At (ISO/local)', 'وقت النشر (ISO/محلي)'),
                    hintText: '2026-02-19T15:30',
                    prefixIcon: const Icon(Icons.schedule_send_rounded),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _ytDefaultLanguageController,
                  onChanged: (_) => _onFormChanged(),
                  decoration: InputDecoration(
                    labelText: _t('Default Language', 'اللغة الافتراضية'),
                    hintText: 'en',
                    prefixIcon: const Icon(Icons.language_rounded),
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: TextField(
                  controller: _ytDefaultAudioLanguageController,
                  onChanged: (_) => _onFormChanged(),
                  decoration: InputDecoration(
                    labelText:
                        _t('Default Audio Language', 'لغة الصوت الافتراضية'),
                    hintText: 'en',
                    prefixIcon: const Icon(Icons.record_voice_over_rounded),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          TextField(
            controller: _ytRecordingDateController,
            onChanged: (_) => _onFormChanged(),
            decoration: InputDecoration(
              labelText: _t(
                  'Recording Date (YYYY-MM-DD)', 'تاريخ التسجيل (YYYY-MM-DD)'),
              hintText: '2026-02-19',
              prefixIcon: const Icon(Icons.event_rounded),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTargetSettingsStep() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        ..._targetPlatforms.map((platform) {
          if (platform == 'twitter' && _hasTwitterTarget) {
            return Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: _buildTwitterTargetSettings(),
            );
          }
          if (platform == 'youtube' && _hasYouTubeTarget) {
            return Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: _buildYouTubeTargetSettings(),
            );
          }
          if (platform == 'telegram' && _hasTelegramTarget) {
            return Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: _buildTelegramTargetSettings(),
            );
          }
          return Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: SfPanelCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    '${_platformLabel(platform)} ${_t('Target Settings', 'إعدادات الهدف')}',
                    style: const TextStyle(
                        fontSize: 16, fontWeight: FontWeight.w900),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    _t('Reserved target settings for this platform.',
                        'إعدادات الهدف لهذا النظام الأساسي محفوظة حالياً.'),
                    style: TextStyle(
                        color: Theme.of(context).colorScheme.onSurfaceVariant),
                  ),
                ],
              ),
            ),
          );
        }),
        if (_targetPlatforms.isEmpty)
          SfPanelCard(
            child: Text(
              _t('Select at least one target to configure settings.',
                  'اختر هدفًا واحدًا على الأقل لضبط الإعدادات.'),
              style: TextStyle(
                  color: Theme.of(context).colorScheme.onSurfaceVariant),
            ),
          ),
      ],
    );
  }

  Widget _switchChip({
    required String label,
    required bool value,
    required ValueChanged<bool> onChanged,
  }) {
    return FilterChip(
      selected: value,
      onSelected: _busy ? null : onChanged,
      label: Text(label),
      selectedColor: Theme.of(context).colorScheme.primary.withAlpha(28),
      checkmarkColor: Theme.of(context).colorScheme.primary,
      side: BorderSide(
          color: Theme.of(context).colorScheme.outline.withAlpha(80)),
    );
  }

  Widget _buildCurrentStepContent() {
    if (_step == 1) {
      return SfPanelCard(
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                _t('Task Info', 'معلومات المهمة'),
                style:
                    const TextStyle(fontSize: 18, fontWeight: FontWeight.w900),
              ),
              const SizedBox(height: 10),
              TextFormField(
                controller: _nameController,
                enabled: !_busy,
                onChanged: (_) => _onFormChanged(),
                decoration: InputDecoration(
                  labelText: _t('Task Name *', 'اسم المهمة *'),
                  prefixIcon: const Icon(Icons.task_alt_rounded),
                ),
                validator: (value) {
                  if ((value ?? '').trim().isEmpty) {
                    return _t('Task name is required.', 'اسم المهمة مطلوب.');
                  }
                  return null;
                },
              ),
              const SizedBox(height: 10),
              TextField(
                controller: _descController,
                enabled: !_busy,
                onChanged: (_) => _onFormChanged(),
                minLines: 2,
                maxLines: 4,
                decoration: InputDecoration(
                  labelText: _t('Description', 'الوصف'),
                  prefixIcon: const Icon(Icons.notes_rounded),
                ),
              ),
              const SizedBox(height: 10),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(
                      color:
                          Theme.of(context).colorScheme.outline.withAlpha(70)),
                  color: Theme.of(context).colorScheme.surface.withAlpha(80),
                ),
                child: Text(
                  _t(
                    'Execution mode: Immediate (matches Next.js wizard default).',
                    'وضع التنفيذ: فوري (مطابق للإعداد الافتراضي في Next.js).',
                  ),
                ),
              ),
            ],
          ),
        ),
      );
    }

    if (_step == 2) {
      return _buildAccountSelectionStep(source: true);
    }

    if (_step == 3) {
      return _buildSourceSettingsStep();
    }

    if (_step == 4) {
      return _buildAccountSelectionStep(source: false);
    }

    return _buildTargetSettingsStep();
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final media = MediaQuery.of(context);
    final bottomInset = media.viewInsets.bottom;
    final sheetHeight =
        (media.size.height * 0.94).clamp(520.0, 980.0).toDouble();

    return SafeArea(
      child: AnimatedPadding(
        duration: const Duration(milliseconds: 180),
        curve: Curves.easeOutCubic,
        padding: EdgeInsets.only(bottom: bottomInset),
        child: SizedBox(
          height: sheetHeight,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
                child: Row(
                  children: [
                    Expanded(
                      child: Text(
                        _isEdit
                            ? _t('Edit Task', 'تعديل مهمة')
                            : _t('Create Task', 'إنشاء مهمة'),
                        style: const TextStyle(
                            fontSize: 20, fontWeight: FontWeight.w900),
                      ),
                    ),
                    IconButton(
                      onPressed:
                          _busy ? null : () => Navigator.of(context).maybePop(),
                      icon: const Icon(Icons.close_rounded),
                    ),
                  ],
                ),
              ),
              if (_error.trim().isNotEmpty)
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 0, 16, 10),
                  child: Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(12),
                      color: scheme.error.withAlpha((0.12 * 255).round()),
                      border: Border.all(
                          color: scheme.error.withAlpha((0.30 * 255).round())),
                    ),
                    child: Row(
                      children: [
                        Icon(Icons.error_outline_rounded, color: scheme.error),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            _error,
                            style: TextStyle(
                                fontWeight: FontWeight.w700,
                                color: scheme.error),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              Expanded(
                child: SingleChildScrollView(
                  keyboardDismissBehavior:
                      ScrollViewKeyboardDismissBehavior.onDrag,
                  padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _buildStepperCard(),
                      const SizedBox(height: 10),
                      _buildCurrentStepContent(),
                    ],
                  ),
                ),
              ),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
                decoration: BoxDecoration(
                  color: Color.alphaBlend(
                      scheme.primary.withAlpha(10), scheme.surface),
                  border: Border(
                    top: BorderSide(color: scheme.outline.withAlpha(82)),
                  ),
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: OutlinedButton(
                        onPressed: (_step == 1 || _busy)
                            ? null
                            : () => unawaited(_handleBack()),
                        child: Text(_t('Back', 'السابق')),
                      ),
                    ),
                    const SizedBox(width: 8),
                    if (!_isEdit && _step < 5)
                      Expanded(
                        child: OutlinedButton(
                          onPressed: _busy
                              ? null
                              : () async {
                                  await _persistDraftNow();
                                  if (!mounted) return;
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    SnackBar(
                                      content: Text(_t('Draft saved locally.',
                                          'تم حفظ المسودة محليًا.')),
                                      behavior: SnackBarBehavior.floating,
                                    ),
                                  );
                                },
                          child: Text(_t('Save Draft', 'حفظ مسودة')),
                        ),
                      ),
                    if (!_isEdit && _step < 5) const SizedBox(width: 8),
                    Expanded(
                      child: FilledButton.icon(
                        onPressed: _busy
                            ? null
                            : () async {
                                if (_step < 5) {
                                  await _handleNext();
                                  return;
                                }

                                for (int s = 1; s <= 5; s++) {
                                  final err = _validateStep(s);
                                  if (err != null) {
                                    setState(() => _step = s);
                                    _setError(err, toast: true);
                                    return;
                                  }
                                }

                                if (_isEdit) {
                                  final ok = await _saveEdit(notify: true);
                                  if (!ok || !mounted) return;
                                  Navigator.of(context).pop(true);
                                  return;
                                }

                                await _createTask();
                              },
                        icon: _busy
                            ? const SizedBox(
                                width: 18,
                                height: 18,
                                child:
                                    CircularProgressIndicator(strokeWidth: 2),
                              )
                            : Icon(
                                _step < 5
                                    ? Icons.arrow_forward_rounded
                                    : (_isEdit
                                        ? Icons.save_rounded
                                        : Icons.add_rounded),
                              ),
                        label: Text(
                          _step < 5
                              ? _t('Next', 'التالي')
                              : (_isEdit
                                  ? _t('Save', 'حفظ')
                                  : _t('Create Task', 'إنشاء المهمة')),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

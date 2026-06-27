import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../features/auth/data/provider_api_service.dart';
import '../network/api_client.dart';
import '../storage/json_cache_store.dart';

class ProviderSession extends ChangeNotifier {
  ProviderSession._() : apiClient = ApiClient(baseUrl: _defaultApiBaseUrl) {
    apiClient.onUnauthorized = _handleUnauthorized;
  }

  static final ProviderSession instance = ProviderSession._();

  static const String _defaultApiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://localhost:4000',
  );
  static const String _tokenKey = 'carepoint.provider.access_token';
  static const String _languageKey = 'carepoint.provider.language_code';
  static const String _challengeIdKey = 'carepoint.provider.challenge_id';
  static const String _challengeEmailKey = 'carepoint.provider.challenge_email';

  final ApiClient apiClient;
  late JsonCacheStore cacheStore;
  late ProviderApiService api;

  String _languageCode = 'en';
  String? _pendingChallengeId;
  String? _pendingEmail;
  String? _lastOtpDevCode;
  String? _lastError;
  Map<String, dynamic>? me;
  bool _busy = false;

  String get languageCode => _languageCode;
  bool get isRtl => _languageCode == 'ar';
  bool get isAuthenticated => apiClient.accessToken != null && me != null;
  bool get isBusy => _busy;
  String? get lastError => _lastError;
  String? get pendingChallengeId => _pendingChallengeId;
  String? get pendingEmail => _pendingEmail;
  String? get lastOtpDevCode => _lastOtpDevCode;
  String get apiBaseUrl => apiClient.baseUrl;
  String get displayName => me?['fullName']?.toString().trim().isNotEmpty == true ? me!['fullName'].toString().trim() : categoryLabel;
  String get roleLabel => me?['role']?.toString().replaceAll('_', ' ') ?? 'PROVIDER';

  /// Human-readable category label based on the provider's role.
  /// Used throughout the app instead of the generic "Provider" word.
  String get categoryLabel {
    final String role = (me?['role']?.toString() ?? '').toUpperCase();
    switch (role) {
      case 'PROVIDER':
        // Check specialty for more specific label
        final String specialty = me?['providerProfile']?['specialty']?.toString().toLowerCase() ?? '';
        if (specialty.contains('nurs')) return 'Nurse';
        if (specialty.contains('physio')) return 'Physiotherapist';
        if (specialty.contains('psych')) return 'Psychologist';
        if (specialty.contains('diet') || specialty.contains('nutri')) return 'Dietitian';
        return 'Doctor';
      case 'NURSE':
        return 'Nurse';
      case 'PHARMACIST':
        return 'Pharmacist';
      case 'LAB_TECH':
        return 'Lab Technician';
      default:
        return 'Doctor';
    }
  }

  Future<void> init() async {
    final SharedPreferences preferences = await SharedPreferences.getInstance();
    cacheStore = await JsonCacheStore.create();
    api = ProviderApiService(client: apiClient, cacheStore: cacheStore);
    _languageCode = preferences.getString(_languageKey) ?? 'en';
    apiClient.localeCode = _languageCode;
    apiClient.accessToken = preferences.getString(_tokenKey);
    _pendingChallengeId = preferences.getString(_challengeIdKey);
    _pendingEmail = preferences.getString(_challengeEmailKey);
    if (apiClient.accessToken != null && apiClient.accessToken!.isNotEmpty) {
      try {
        await loadMe();
      } catch (_) {
        await logout(notify: false);
      }
    }
    notifyListeners();
  }

  void setLanguage(String code) {
    _languageCode = code == 'ar' ? 'ar' : 'en';
    apiClient.localeCode = _languageCode;
    unawaited(_persistLanguage());
    notifyListeners();
  }

  Future<void> startChallenge({
    required String email,
    required String password,
    bool managedDevice = true,
    bool riskAcknowledged = true,
    String channel = 'totp',
  }) async {
    _busy = true;
    _lastError = null;
    notifyListeners();
    try {
      final Map<String, dynamic> response = await api.startPrivilegedChallenge(
        email: email,
        password: password,
        managedDevice: managedDevice,
        riskAcknowledged: riskAcknowledged,
        channel: channel,
      );
      _pendingChallengeId = response['challengeId']?.toString();
      _pendingEmail = email.trim();
      _lastOtpDevCode = response['devCode']?.toString();
      await _persistChallenge();
    } catch (error) {
      _lastError = error.toString();
      rethrow;
    } finally {
      _busy = false;
      notifyListeners();
    }
  }

  Future<void> resendChallenge() async {
    final String? challengeId = _pendingChallengeId;
    if (challengeId == null || challengeId.isEmpty) return;
    _busy = true;
    _lastError = null;
    notifyListeners();
    try {
      final Map<String, dynamic> response = await api.resendPrivilegedChallenge(challengeId);
      _lastOtpDevCode = response['devCode']?.toString();
    } catch (error) {
      _lastError = error.toString();
      rethrow;
    } finally {
      _busy = false;
      notifyListeners();
    }
  }

  Future<void> verifyChallenge(String code) async {
    final String? challengeId = _pendingChallengeId;
    if (challengeId == null || challengeId.isEmpty) {
      throw StateError('No pending sign-in challenge found.');
    }

    _busy = true;
    _lastError = null;
    notifyListeners();
    try {
      final Map<String, dynamic> response = await api.verifyPrivilegedChallenge(challengeId: challengeId, code: code);
      apiClient.accessToken = response['accessToken']?.toString();
      if (apiClient.accessToken == null || apiClient.accessToken!.isEmpty) {
        throw StateError('Access token missing from sign-in response.');
      }
      await _persistAccessToken();
      await loadMe();
      _pendingChallengeId = null;
      _pendingEmail = null;
      _lastOtpDevCode = null;
      await _clearChallenge();
    } catch (error) {
      _lastError = error.toString();
      rethrow;
    } finally {
      _busy = false;
      notifyListeners();
    }
  }

  Future<void> loadMe() async {
    final Map<String, dynamic> response = await apiClient.getJson('/api/auth/me');
    final String role = response['role']?.toString() ?? '';
    if (role.toUpperCase() == 'PATIENT') {
      throw StateError('This mobile application is only for provider-side roles.');
    }
    me = response;
    notifyListeners();
  }

  Future<void> logout({bool notify = true}) async {
    apiClient.accessToken = null;
    me = null;
    _pendingChallengeId = null;
    _pendingEmail = null;
    _lastOtpDevCode = null;
    final SharedPreferences preferences = await SharedPreferences.getInstance();
    await preferences.remove(_tokenKey);
    await preferences.remove(_challengeIdKey);
    await preferences.remove(_challengeEmailKey);
    if (notify) {
      notifyListeners();
    }
  }

  Future<void> _persistAccessToken() async {
    final SharedPreferences preferences = await SharedPreferences.getInstance();
    await preferences.setString(_tokenKey, apiClient.accessToken ?? '');
  }

  Future<void> _persistLanguage() async {
    final SharedPreferences preferences = await SharedPreferences.getInstance();
    await preferences.setString(_languageKey, _languageCode);
  }

  Future<void> _persistChallenge() async {
    final SharedPreferences preferences = await SharedPreferences.getInstance();
    if (_pendingChallengeId != null) {
      await preferences.setString(_challengeIdKey, _pendingChallengeId!);
    }
    if (_pendingEmail != null) {
      await preferences.setString(_challengeEmailKey, _pendingEmail!);
    }
  }

  Future<void> _clearChallenge() async {
    final SharedPreferences preferences = await SharedPreferences.getInstance();
    await preferences.remove(_challengeIdKey);
    await preferences.remove(_challengeEmailKey);
  }

  void _handleUnauthorized() {
    unawaited(logout());
  }
}

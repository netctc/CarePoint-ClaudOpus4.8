import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../network/api_client.dart';

class AppSession extends ChangeNotifier {
  AppSession._() : api = ApiClient(baseUrl: _defaultApiBaseUrl) {
    api.onUnauthorized = _handleUnauthorized;
  }

  static final AppSession instance = AppSession._();

  static const String _defaultApiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://localhost:4000',
  );
  static const String _languagePreferenceKey = 'carepoint.language_code';
  static const String _activeSubjectPreferenceKey = 'carepoint.active_subject_id';
  static const String _activeSubjectContextPreferenceKey = 'carepoint.active_subject_context';
  static const String _questionnaireDraftPreferenceKeyPrefix = 'carepoint.questionnaire_draft.';
  static const String _medicalProfileDraftPreferenceKeyPrefix = 'carepoint.medical_profile_draft.';

  final ApiClient api;

  Map<String, dynamic>? me;
  bool _isCheckingApi = false;
  String? _lastError;
  String _languageCode = 'en';
  bool _profileSetupComplete = false;
  bool _consentComplete = false;
  Map<String, dynamic>? _profileDraft;
  Map<String, bool> _consentChoices = <String, bool>{
    'telehealth': true,
    'dataSharing': true,
    'notifications': true,
  };
  Map<String, bool>? _entryConsentDraft;
  String? _pendingOtpIdentifier;
  int? _otpResendAvailableAtMs;
  String? _lastOtpDevCode;
  String? _activeSubjectId;
  String _activeSubjectLabel = 'My profile';
  String? _activeSubjectRelationship;

  String get apiBaseUrl => api.baseUrl;
  bool get isCheckingApi => _isCheckingApi;
  bool get isAuthenticated => api.accessToken != null && me != null;
  String? get lastError => _lastError;
  String get languageCode => _languageCode;
  bool get profileSetupComplete => _profileSetupComplete;
  bool get consentComplete => _consentComplete;
  Map<String, dynamic>? get profileDraft => _profileDraft;
  Map<String, bool> get consentChoices => Map<String, bool>.from(_consentChoices);
  Map<String, bool>? get entryConsentDraft => _entryConsentDraft == null ? null : Map<String, bool>.from(_entryConsentDraft!);
  bool get onboardingComplete => _profileSetupComplete && _consentComplete;
  String? get pendingOtpIdentifier => _pendingOtpIdentifier;
  int? get otpResendAvailableAtMs => _otpResendAvailableAtMs;
  String? get lastOtpDevCode => _lastOtpDevCode;
  bool get isRtl => _languageCode == 'ar';
  String? get activeSubjectId => _activeSubjectId;
  bool get isSelfSubject => _activeSubjectId == null || _activeSubjectId!.isEmpty;
  String get activeSubjectLabel => _activeSubjectLabel;
  String? get activeSubjectRelationship => _activeSubjectRelationship;

  void _handleUnauthorized() {
    if (api.accessToken == null && me == null) {
      return;
    }
    logout(notify: true);
  }

  Future<void> init() async {
    final SharedPreferences preferences = await SharedPreferences.getInstance();
    _languageCode = preferences.getString(_languagePreferenceKey) ?? 'en';
    _activeSubjectId = preferences.getString(_activeSubjectPreferenceKey);
    final String? subjectContextRaw = preferences.getString(_activeSubjectContextPreferenceKey);
    if (subjectContextRaw != null && subjectContextRaw.isNotEmpty) {
      try {
        final Map<String, dynamic> subjectContext = Map<String, dynamic>.from(jsonDecode(subjectContextRaw) as Map);
        _activeSubjectLabel = subjectContext['label']?.toString().trim().isNotEmpty == true ? subjectContext['label'].toString().trim() : _defaultSelfSubjectLabel;
        _activeSubjectRelationship = subjectContext['relationship']?.toString().trim().isNotEmpty == true ? subjectContext['relationship'].toString().trim() : null;
      } catch (_) {
        _activeSubjectLabel = _defaultSelfSubjectLabel;
        _activeSubjectRelationship = null;
      }
    } else {
      _activeSubjectLabel = _defaultSelfSubjectLabel;
      _activeSubjectRelationship = null;
    }
    api.localeCode = _languageCode;
    notifyListeners();
  }

  void setLanguage(String code) {
    _languageCode = code == 'ar' ? 'ar' : 'en';
    api.localeCode = _languageCode;
    if (isSelfSubject) {
      _activeSubjectLabel = _defaultSelfSubjectLabel;
      unawaited(_persistActiveSubjectPreference());
    }
    unawaited(_persistLanguagePreference());
    notifyListeners();
  }

  void setEntryConsentDraft({
    required bool telehealth,
    required bool dataSharing,
    required bool notifications,
  }) {
    _entryConsentDraft = <String, bool>{
      'telehealth': telehealth,
      'dataSharing': dataSharing,
      'notifications': notifications,
    };
    notifyListeners();
  }

  String get _defaultSelfSubjectLabel => _languageCode == 'ar' ? 'ملفي' : 'My profile';

  Future<void> selectSelfSubject() async {
    _activeSubjectId = null;
    _activeSubjectLabel = _defaultSelfSubjectLabel;
    _activeSubjectRelationship = null;
    await _persistActiveSubjectPreference();
    notifyListeners();
  }

  Future<void> selectFamilySubject({required String profileId, required String label, String? relationship}) async {
    _activeSubjectId = profileId;
    _activeSubjectLabel = label.trim().isEmpty ? (_languageCode == 'ar' ? 'فرد من العائلة' : 'Family member') : label.trim();
    _activeSubjectRelationship = relationship?.trim().isEmpty ?? true ? null : relationship!.trim();
    await _persistActiveSubjectPreference();
    notifyListeners();
  }

  Future<void> _persistActiveSubjectPreference() async {
    final SharedPreferences preferences = await SharedPreferences.getInstance();
    if (_activeSubjectId == null || _activeSubjectId!.isEmpty) {
      await preferences.remove(_activeSubjectPreferenceKey);
      await preferences.setString(_activeSubjectContextPreferenceKey, jsonEncode(<String, dynamic>{
        'id': null,
        'label': _defaultSelfSubjectLabel,
        'relationship': null,
      }));
      return;
    }
    await preferences.setString(_activeSubjectPreferenceKey, _activeSubjectId!);
    await preferences.setString(_activeSubjectContextPreferenceKey, jsonEncode(<String, dynamic>{
      'id': _activeSubjectId,
      'label': _activeSubjectLabel,
      'relationship': _activeSubjectRelationship,
    }));
  }

  Future<void> _persistLanguagePreference() async {
    final SharedPreferences preferences = await SharedPreferences.getInstance();
    await preferences.setString(_languagePreferenceKey, _languageCode);
    if (isAuthenticated) {
      try {
        await api.patchJson('/api/patient/preferences', <String, dynamic>{'locale': _languageCode});
      } catch (_) {
        // Keep local preference even if backend persistence is temporarily unavailable.
      }
    }
  }

  Future<void> saveProfileSetup(Map<String, dynamic> value) async {
    _isCheckingApi = true;
    _lastError = null;
    notifyListeners();

    try {
      final Map<String, dynamic> result = await api.putJson('/api/patient/profile', value);
      final Map<String, dynamic> profile = (result['profile'] as Map?)?.cast<String, dynamic>() ?? Map<String, dynamic>.from(value);
      _profileDraft = <String, dynamic>{
        'fullName': profile['fullName']?.toString() ?? value['fullName']?.toString() ?? '',
        'dateOfBirth': _formatDateOfBirth(profile['dateOfBirth']?.toString() ?? value['dateOfBirth']?.toString()),
        'nationalId': profile['nationalId']?.toString() ?? value['nationalId']?.toString() ?? '',
        'emergencyContact': profile['emergencyContact']?.toString() ?? value['emergencyContact']?.toString() ?? '',
        'gender': profile['gender']?.toString() ?? value['gender']?.toString(),
        'nationality': profile['nationality']?.toString() ?? value['nationality']?.toString(),
        'countryRegion': profile['countryRegion']?.toString() ?? value['countryRegion']?.toString() ?? 'Lebanon',
      };
      _profileSetupComplete = true;
      await loadMe();
    } on ApiClientException catch (error) {
      _lastError = error.message;
      rethrow;
    } catch (error) {
      _lastError = error.toString();
      rethrow;
    } finally {
      _isCheckingApi = false;
      notifyListeners();
    }
  }

  Future<Map<String, dynamic>> loadMedicalProfile() {
    if (isSelfSubject) {
      return api.getJson('/api/patient/profile/medical');
    }
    return api.getJson('/api/patient/family/profiles/${Uri.encodeComponent(_activeSubjectId!)}/medical');
  }

  Future<Map<String, dynamic>> saveMedicalProfile({
    Map<String, dynamic>? questionnaire,
    required List<Map<String, dynamic>> reports,
    required bool shareMedicalDataWithAssignedDoctors,
  }) async {
    final Map<String, dynamic> payload = <String, dynamic>{
      if (questionnaire != null) 'questionnaire': questionnaire,
      'reports': reports,
      'shareMedicalDataWithAssignedDoctors': shareMedicalDataWithAssignedDoctors,
    };
    final Map<String, dynamic> result = isSelfSubject
        ? await api.putJson('/api/patient/profile/medical', payload)
        : await api.putJson('/api/patient/family/profiles/${Uri.encodeComponent(_activeSubjectId!)}/medical', payload);
    await clearMedicalProfileDraft();
    return result;
  }


  String get _questionnaireDraftPreferenceKey {
    final String subjectKey = isSelfSubject ? 'self' : _activeSubjectId!;
    return '$_questionnaireDraftPreferenceKeyPrefix$subjectKey';
  }

  Future<void> saveQuestionnaireDraft(Map<String, dynamic> value) async {
    final SharedPreferences preferences = await SharedPreferences.getInstance();
    await preferences.setString(_questionnaireDraftPreferenceKey, jsonEncode(value));
  }

  Future<Map<String, dynamic>?> loadQuestionnaireDraft() async {
    final SharedPreferences preferences = await SharedPreferences.getInstance();
    final String? raw = preferences.getString(_questionnaireDraftPreferenceKey);
    if (raw == null || raw.trim().isEmpty) {
      return null;
    }
    try {
      return Map<String, dynamic>.from(jsonDecode(raw) as Map);
    } catch (_) {
      await preferences.remove(_questionnaireDraftPreferenceKey);
      return null;
    }
  }

  Future<void> clearQuestionnaireDraft() async {
    final SharedPreferences preferences = await SharedPreferences.getInstance();
    await preferences.remove(_questionnaireDraftPreferenceKey);
  }

  String get _medicalProfileDraftPreferenceKey {
    final String subjectKey = isSelfSubject ? 'self' : _activeSubjectId!;
    return '$_medicalProfileDraftPreferenceKeyPrefix$subjectKey';
  }

  Future<void> saveMedicalProfileDraft(Map<String, dynamic> value) async {
    final SharedPreferences preferences = await SharedPreferences.getInstance();
    await preferences.setString(_medicalProfileDraftPreferenceKey, jsonEncode(value));
  }

  Future<Map<String, dynamic>?> loadMedicalProfileDraft() async {
    final SharedPreferences preferences = await SharedPreferences.getInstance();
    final String? raw = preferences.getString(_medicalProfileDraftPreferenceKey);
    if (raw == null || raw.trim().isEmpty) {
      return null;
    }
    try {
      return Map<String, dynamic>.from(jsonDecode(raw) as Map);
    } catch (_) {
      await preferences.remove(_medicalProfileDraftPreferenceKey);
      return null;
    }
  }

  Future<void> clearMedicalProfileDraft() async {
    final SharedPreferences preferences = await SharedPreferences.getInstance();
    await preferences.remove(_medicalProfileDraftPreferenceKey);
  }

  Future<void> saveConsent({
    required bool telehealth,
    required bool dataSharing,
    required bool notifications,
  }) async {
    _consentChoices = <String, bool>{
      'telehealth': telehealth,
      'dataSharing': dataSharing,
      'notifications': notifications,
    };
    await api.putJson('/api/patient/consents/consent-telehealth', <String, dynamic>{
      'decision': telehealth ? 'ACCEPTED' : 'REVOKED',
      'locale': _languageCode,
    });
    await api.putJson('/api/patient/consents/consent-data-sharing', <String, dynamic>{
      'decision': dataSharing ? 'ACCEPTED' : 'REVOKED',
      'locale': _languageCode,
    });
    await api.putJson('/api/patient/consents/consent-notifications', <String, dynamic>{
      'decision': notifications ? 'ACCEPTED' : 'REVOKED',
      'locale': _languageCode,
    });
    _consentComplete = telehealth && dataSharing;
    notifyListeners();
  }

  Future<void> requestOtp({
    required String identifier,
    String? firstName,
    String? lastName,
  }) async {
    _isCheckingApi = true;
    _lastError = null;
    notifyListeners();

    try {
      // Use /otp/register which handles both new and existing patients:
      // - New email: creates PATIENT user + sends OTP
      // - Existing PATIENT: just sends OTP (same as login)
      final Map<String, dynamic> body = <String, dynamic>{
        'email': identifier.trim().toLowerCase(),
        'firstName': (firstName ?? '').trim().isEmpty ? 'Patient' : firstName!.trim(),
        'lastName': (lastName ?? '').trim().isEmpty ? 'User' : lastName!.trim(),
        'channel': 'email',
      };
      final Map<String, dynamic> result = await api.postJson('/api/auth/otp/register', body);
      _pendingOtpIdentifier = identifier.trim().toLowerCase();
      _otpResendAvailableAtMs = DateTime.now().millisecondsSinceEpoch + ((result['resendAfterSeconds'] as num?)?.toInt() ?? 60) * 1000;
      _lastOtpDevCode = result['devCode']?.toString();
    } on ApiClientException catch (error) {
      _lastError = error.message;
      rethrow;
    } catch (error) {
      _lastError = error.toString();
      rethrow;
    } finally {
      _isCheckingApi = false;
      notifyListeners();
    }
  }

  Future<void> resendOtp() async {
    final String identifier = _pendingOtpIdentifier ?? '';
    if (identifier.isEmpty) {
      throw StateError('No OTP challenge is active.');
    }
    _isCheckingApi = true;
    _lastError = null;
    notifyListeners();

    try {
      final Map<String, dynamic> result = await api.postJson('/api/auth/otp/resend', <String, dynamic>{
        'identifier': identifier.trim().toLowerCase(),
        'channel': 'email',
      });
      _otpResendAvailableAtMs = DateTime.now().millisecondsSinceEpoch + ((result['resendAfterSeconds'] as num?)?.toInt() ?? 60) * 1000;
      _lastOtpDevCode = result['devCode']?.toString();
    } on ApiClientException catch (error) {
      _lastError = error.message;
      rethrow;
    } catch (error) {
      _lastError = error.toString();
      rethrow;
    } finally {
      _isCheckingApi = false;
      notifyListeners();
    }
  }

  Future<void> verifyOtp({required String identifier, required String code}) async {
    _isCheckingApi = true;
    _lastError = null;
    notifyListeners();

    try {
      final Map<String, dynamic> result = await api.postJson('/api/auth/otp/verify', <String, dynamic>{
        'identifier': identifier.trim().toLowerCase(),
        'code': code.trim(),
      });
      api.accessToken = result['accessToken'] as String?;
      _pendingOtpIdentifier = null;
      _otpResendAvailableAtMs = null;
      _lastOtpDevCode = null;
      await loadMe();
      await _loadPatientPreferences();
      await _loadPatientProfile();
      await _loadPatientConsentSummary();
      await syncActiveSubjectContext();
      if (_entryConsentDraft != null) {
        try {
          await saveConsent(
            telehealth: _entryConsentDraft!['telehealth'] ?? true,
            dataSharing: _entryConsentDraft!['dataSharing'] ?? true,
            notifications: _entryConsentDraft!['notifications'] ?? true,
          );
        } catch (_) {
          // Do not block sign-in completion if consent persistence fails temporarily.
        }
        _entryConsentDraft = null;
      }
    } on ApiClientException catch (error) {
      _lastError = error.message;
      rethrow;
    } catch (error) {
      _lastError = error.toString();
      rethrow;
    } finally {
      _isCheckingApi = false;
      notifyListeners();
    }
  }


  String? get requestSubjectProfileId => isSelfSubject ? null : _activeSubjectId;

  String _withSubjectQuery(String path, {String param = 'subjectProfileId'}) {
    final String? subjectProfileId = requestSubjectProfileId;
    if (subjectProfileId == null || subjectProfileId.isEmpty) return path;
    final String separator = path.contains('?') ? '&' : '?';
    return '$path$separator$param=${Uri.encodeQueryComponent(subjectProfileId)}';
  }

  Map<String, dynamic> _withSubjectBody(Map<String, dynamic> body, {String key = 'subjectProfileId'}) {
    final String? subjectProfileId = requestSubjectProfileId;
    if (subjectProfileId == null || subjectProfileId.isEmpty) return body;
    return <String, dynamic>{
      ...body,
      key: subjectProfileId,
      'subjectLabel': _activeSubjectLabel,
    };
  }

  String _formatDateOfBirth(String? value) {
    if (value == null || value.trim().isEmpty) return '';
    final DateTime? parsed = DateTime.tryParse(value);
    if (parsed == null) return value;
    return '${parsed.day.toString().padLeft(2, '0')}/${parsed.month.toString().padLeft(2, '0')}/${parsed.year}';
  }

  Future<void> _loadPatientProfile() async {
    if (!isAuthenticated) return;
    try {
      final Map<String, dynamic> result = await api.getJson('/api/patient/profile');
      final Map<String, dynamic> profile = (result['profile'] as Map?)?.cast<String, dynamic>() ?? <String, dynamic>{};
      if (profile.isEmpty) return;
      _profileDraft = <String, dynamic>{
        'fullName': profile['fullName']?.toString() ?? me?['fullName']?.toString() ?? '',
        'dateOfBirth': _formatDateOfBirth(profile['dateOfBirth']?.toString()),
        'nationalId': profile['nationalId']?.toString() ?? '',
        'emergencyContact': profile['emergencyContact']?.toString() ?? '',
        'gender': profile['gender']?.toString(),
        'nationality': profile['nationality']?.toString(),
        'countryRegion': profile['countryRegion']?.toString() ?? 'Lebanon',
      };
      _profileSetupComplete = (_profileDraft?['fullName']?.toString().trim().isNotEmpty ?? false) &&
          (_profileDraft?['dateOfBirth']?.toString().trim().isNotEmpty ?? false) &&
          (_profileDraft?['gender']?.toString().trim().isNotEmpty ?? false) &&
          (_profileDraft?['countryRegion']?.toString().trim().isNotEmpty ?? false) &&
          (_profileDraft?['emergencyContact']?.toString().trim().isNotEmpty ?? false);
    } catch (_) {
      // Continue using local state when profile retrieval is unavailable.
    }
  }

  Future<void> loadMeAndOnboarding() async {
    await loadMe();
    await _loadPatientPreferences();
    await _loadPatientProfile();
    await _loadPatientConsentSummary();
    await syncActiveSubjectContext();
  }

  Future<Map<String, dynamic>> loadMe() async {
    try {
      me = await api.getJson('/api/auth/me');
      _lastError = null;
      final Map<String, dynamic>? patientProfile = me?['patientProfile'] as Map<String, dynamic>?;
      if (patientProfile != null && patientProfile.isNotEmpty) {
        _profileDraft = <String, dynamic>{
          'fullName': me?['fullName']?.toString() ?? patientProfile['fullName']?.toString() ?? '',
          'dateOfBirth': _formatDateOfBirth(patientProfile['dateOfBirth']?.toString()),
          'nationalId': patientProfile['nationalId']?.toString() ?? '',
          'countryRegion': patientProfile['countryRegion']?.toString() ?? 'Lebanon',
          'gender': patientProfile['gender']?.toString() ?? '',
          'nationality': patientProfile['nationality']?.toString() ?? '',
          'emergencyContact': patientProfile['emergencyContact']?.toString() ?? '',
        };
        _profileSetupComplete = (_profileDraft?['fullName']?.toString().trim().isNotEmpty ?? false) &&
            (_profileDraft?['dateOfBirth']?.toString().trim().isNotEmpty ?? false) &&
            (_profileDraft?['gender']?.toString().trim().isNotEmpty ?? false) &&
            (_profileDraft?['countryRegion']?.toString().trim().isNotEmpty ?? false) &&
            (_profileDraft?['emergencyContact']?.toString().trim().isNotEmpty ?? false);
      }
      notifyListeners();
      return me!;
    } on ApiClientException catch (error) {
      if (error.isUnauthorized) {
        logout(notify: false);
      }
      _lastError = error.message;
      notifyListeners();
      rethrow;
    } catch (error) {
      _lastError = error.toString();
      notifyListeners();
      rethrow;
    }
  }

  Future<void> _loadPatientPreferences() async {
    if (!isAuthenticated) return;
    try {
      final Map<String, dynamic> result = await api.getJson('/api/patient/preferences');
      final Map<String, dynamic> preferences = (result['preferences'] as Map?)?.cast<String, dynamic>() ?? <String, dynamic>{};
      final String locale = preferences['locale']?.toString() ?? _languageCode;
      if (locale == 'ar' || locale == 'en') {
        _languageCode = locale;
        await _persistLanguagePreference();
      }
    } catch (_) {
      // Keep onboarding moving when preferences are unavailable.
    }
  }

  Future<void> syncActiveSubjectContext() async {
    if (!isAuthenticated) return;
    if (_activeSubjectId == null || _activeSubjectId!.isEmpty) {
      _activeSubjectLabel = _defaultSelfSubjectLabel;
      _activeSubjectRelationship = null;
      await _persistActiveSubjectPreference();
      notifyListeners();
      return;
    }
    try {
      final Map<String, dynamic> result = await patientFamilyProfiles();
      final List<Map<String, dynamic>> items = ((result['items'] as List?) ?? <dynamic>[])
          .whereType<Map>()
          .map((Map item) => item.cast<String, dynamic>())
          .toList();
      final Map<String, dynamic>? selected = items.cast<Map<String, dynamic>?>().firstWhere(
        (Map<String, dynamic>? item) => item?['id']?.toString() == _activeSubjectId,
        orElse: () => null,
      );
      if (selected == null) {
        await selectSelfSubject();
        return;
      }
      _activeSubjectLabel = selected['profileName']?.toString().trim().isNotEmpty == true
          ? selected['profileName'].toString().trim()
          : (selected['title']?.toString().trim().isNotEmpty == true ? selected['title'].toString().trim() : (_languageCode == 'ar' ? 'فرد من العائلة' : 'Family member'));
      _activeSubjectRelationship = selected['relationship']?.toString().trim().isNotEmpty == true ? selected['relationship'].toString().trim() : null;
      await _persistActiveSubjectPreference();
      notifyListeners();
    } catch (_) {
      // Keep the locally persisted subject context when family profile sync is temporarily unavailable.
    }
  }

  Future<void> _loadPatientConsentSummary() async {
    if (!isAuthenticated) return;
    try {
      final Map<String, dynamic> result = await api.getJson('/api/patient/consents');
      final List<dynamic> items = (result['items'] as List?) ?? <dynamic>[];
      bool telehealth = _consentChoices['telehealth'] ?? true;
      bool dataSharing = _consentChoices['dataSharing'] ?? true;
      bool notifications = _consentChoices['notifications'] ?? true;
      for (final dynamic entry in items) {
        if (entry is! Map) continue;
        final String type = entry['consentType']?.toString().toUpperCase() ?? '';
        final bool accepted = entry['status']?.toString().toUpperCase() == 'ACCEPTED';
        if (type == 'TELEHEALTH') telehealth = accepted;
        if (type == 'DATA_SHARING') dataSharing = accepted;
        if (type == 'NOTIFICATIONS') notifications = accepted;
      }
      _consentChoices = <String, bool>{
        'telehealth': telehealth,
        'dataSharing': dataSharing,
        'notifications': notifications,
      };
      _consentComplete = telehealth && dataSharing;
    } catch (_) {
      // Use local draft when consent read is unavailable.
    }
  }

  void logout({bool notify = true}) {
    api.accessToken = null;
    me = null;
    _lastError = null;
    _pendingOtpIdentifier = null;
    _otpResendAvailableAtMs = null;
    _lastOtpDevCode = null;
    _entryConsentDraft = null;
    _activeSubjectId = null;
    _activeSubjectLabel = _defaultSelfSubjectLabel;
    _activeSubjectRelationship = null;
    unawaited(_persistActiveSubjectPreference());
    if (notify) {
      notifyListeners();
    }
  }

  String? get organizationId => me?['organizationId'] as String?;
  String? get patientProfileId => (me?['patientProfile'] as Map<String, dynamic>?)?['id'] as String?;
  String? get providerProfileId => (me?['providerProfile'] as Map<String, dynamic>?)?['id'] as String?;

  Future<Map<String, dynamic>> dashboard() => api.getJson(_withSubjectQuery('/api/dashboard/patient'));
  Future<Map<String, dynamic>> questionnaireLatest() => api.getJson(_withSubjectQuery('/api/patient/questionnaires/latest'));
  Future<Map<String, dynamic>> questionnaireHistory() => api.getJson(_withSubjectQuery('/api/patient/questionnaires/history'));
  Future<Map<String, dynamic>> questionnaireVersion(String versionId) => api.getJson(_withSubjectQuery('/api/patient/questionnaires/${Uri.encodeComponent(versionId)}'));
  Future<Map<String, dynamic>> submitQuestionnaireVersion(Map<String, dynamic> questionnaire) => api.postJson('/api/patient/questionnaires/versions', _withSubjectBody(<String, dynamic>{'questionnaire': questionnaire}));
  Future<Map<String, dynamic>> providers([String? query]) => api.getJson('/api/providers${query != null && query.isNotEmpty ? '?q=$query' : ''}');
  Future<Map<String, dynamic>> availableSlots({
    required String providerId,
    required String service,
    String? location,
    int days = 10,
  }) {
    final StringBuffer path = StringBuffer('/api/appointments/availability?providerId=$providerId&service=${Uri.encodeQueryComponent(service)}&days=$days');
    if (location != null && location.trim().isNotEmpty) {
      path.write('&location=${Uri.encodeQueryComponent(location.trim())}');
    }
    return api.getJson(_withSubjectQuery(path.toString()));
  }

  Future<Map<String, dynamic>> bookingPolicyPreview({
    required String providerId,
    required String service,
    required String location,
    required DateTime startsAt,
    required DateTime endsAt,
  }) => api.getJson(_withSubjectQuery('/api/appointments/booking-policy-preview?providerId=$providerId&service=${Uri.encodeQueryComponent(service)}&location=${Uri.encodeQueryComponent(location)}&startsAt=${Uri.encodeQueryComponent(startsAt.toUtc().toIso8601String())}&endsAt=${Uri.encodeQueryComponent(endsAt.toUtc().toIso8601String())}'));

  Future<Map<String, dynamic>> createSlotHold({
    required String providerId,
    required String service,
    required String location,
    required DateTime startsAt,
    required DateTime endsAt,
  }) => api.postJson('/api/appointments/holds', _withSubjectBody(<String, dynamic>{
        'providerId': providerId,
        'service': service,
        'location': location,
        'startsAt': startsAt.toUtc().toIso8601String(),
        'endsAt': endsAt.toUtc().toIso8601String(),
      }));

  Future<Map<String, dynamic>> activeHolds({int limit = 10}) => api.getJson(_withSubjectQuery('/api/appointments/holds?limit=$limit'));
  Future<Map<String, dynamic>> releaseSlotHold(String holdId) => api.postJson('/api/appointments/holds/$holdId/release', _withSubjectBody(<String, dynamic>{}));
  Future<Map<String, dynamic>> extendSlotHold(String holdId, {int extendMinutes = 5, String? note}) => api.postJson('/api/appointments/holds/$holdId/extend', _withSubjectBody(<String, dynamic>{
        'extendMinutes': extendMinutes,
        if (note != null && note.isNotEmpty) 'note': note,
      }));

  Future<Map<String, dynamic>> appointments() => api.getJson(_withSubjectQuery('/api/appointments'));
  Future<Map<String, dynamic>> appointmentDetail(String appointmentId) => api.getJson(_withSubjectQuery('/api/appointments/${Uri.encodeComponent(appointmentId)}'));
  Future<Map<String, dynamic>> appointmentAccessConsent(String appointmentId) => api.getJson(_withSubjectQuery('/api/appointments/${Uri.encodeComponent(appointmentId)}/access-consent'));
  Future<Map<String, dynamic>> grantAppointmentAccessConsent(String appointmentId, {String? note}) => api.postJson('/api/appointments/${Uri.encodeComponent(appointmentId)}/access-consent/grant', _withSubjectBody(<String, dynamic>{if (note != null && note.isNotEmpty) 'note': note}));
  Future<Map<String, dynamic>> revokeAppointmentAccessConsent(String appointmentId, {String? note}) => api.postJson('/api/appointments/${Uri.encodeComponent(appointmentId)}/access-consent/revoke', _withSubjectBody(<String, dynamic>{if (note != null && note.isNotEmpty) 'note': note}));
  Future<Map<String, dynamic>> records() => api.getJson(_withSubjectQuery('/api/records'));
  Future<Map<String, dynamic>> patientLabs() => api.getJson(_withSubjectQuery('/api/records/patient-labs'));
  Future<Map<String, dynamic>> patientLabDetail(String labId) => api.getJson(_withSubjectQuery('/api/records/patient-labs/$labId'));
  Future<Map<String, dynamic>> patientPrescriptions() => api.getJson(_withSubjectQuery('/api/records/patient-prescriptions'));
  Future<Map<String, dynamic>> patientPrescriptionDetail(String prescriptionId) => api.getJson(_withSubjectQuery('/api/records/patient-prescriptions/$prescriptionId'));
  Future<Map<String, dynamic>> requestPrescriptionRefill(String prescriptionId, {String? note}) => api.postJson('/api/records/patient-prescriptions/$prescriptionId/refill-request', _withSubjectBody(<String, dynamic>{if (note != null && note.isNotEmpty) 'note': note}));
  Future<Map<String, dynamic>> refillRequests({String status = 'ALL'}) => api.getJson(_withSubjectQuery('/api/records/refill-requests?status=${Uri.encodeQueryComponent(status)}'));
  Future<Map<String, dynamic>> threads() => api.getJson('/api/messaging/threads');
  Future<Map<String, dynamic>> thread(String threadId) => api.getJson('/api/messaging/threads/$threadId');
  Future<Map<String, dynamic>> sendMessage(String threadId, String body) => api.postJson('/api/messaging/messages', <String, dynamic>{
        'threadId': threadId,
        'body': body,
        'attachments': <String>[],
      });
  Future<Map<String, dynamic>> telehealthSessions() => api.getJson('/api/telehealth/sessions');
  Future<Map<String, dynamic>> payments() => api.getJson('/api/payments');

  Future<Map<String, dynamic>> walletMethods() => api.getJson('/api/payments/wallet-methods');
  Future<Map<String, dynamic>> bookingDocuments({String? holdId, String? appointmentId}) {
    final StringBuffer path = StringBuffer('/api/appointments/booking-documents');
    final List<String> query = <String>[];
    if (holdId != null && holdId.isNotEmpty) query.add('holdId=${Uri.encodeQueryComponent(holdId)}');
    if (appointmentId != null && appointmentId.isNotEmpty) query.add('appointmentId=${Uri.encodeQueryComponent(appointmentId)}');
    if (query.isNotEmpty) path.write('?${query.join('&')}');
    final String withSubject = _withSubjectQuery(path.toString());
    return api.getJson(withSubject);
  }
  Future<Map<String, dynamic>> uploadBookingDocument({
    required String kind,
    required String fileName,
    required String ocrPreview,
    List<String> redactedFields = const <String>[],
    String? holdId,
  }) => api.postJson('/api/appointments/booking-documents', _withSubjectBody(<String, dynamic>{
        'holdId': holdId,
        'kind': kind,
        'fileName': fileName,
        'ocrPreview': ocrPreview,
        'redactedFields': redactedFields,
      }));
  Future<Map<String, dynamic>> redactBookingDocument({
    required String documentId,
    required List<String> redactedFields,
    required String ocrPreview,
  }) => api.patchJson('/api/appointments/booking-documents/$documentId/redaction', _withSubjectBody(<String, dynamic>{
        'redactedFields': redactedFields,
        'ocrPreview': ocrPreview,
      }));
  Future<Map<String, dynamic>> addWalletMethod({
    required String type,
    required String brand,
    required String label,
    required String last4,
    bool setDefault = false,
  }) => api.postJson('/api/payments/wallet-methods', <String, dynamic>{
        'type': type,
        'brand': brand,
        'label': label,
        'last4': last4,
        'setDefault': setDefault,
      });
  Future<Map<String, dynamic>> setDefaultWalletMethod(String methodId) => api.postJson('/api/payments/wallet-methods/$methodId/default', <String, dynamic>{});
  Future<Map<String, dynamic>> deleteWalletMethod(String methodId) => api.deleteJson('/api/payments/wallet-methods/$methodId');

  Future<Map<String, dynamic>> patientFamilySummary() => api.getJson('/api/patient/family/summary');
  Future<Map<String, dynamic>> patientFamilyProfiles() => api.getJson('/api/patient/family/profiles');
  Future<Map<String, dynamic>> patientFamilyProfile(String profileId) => api.getJson('/api/patient/family/profiles/${Uri.encodeComponent(profileId)}');
  Future<Map<String, dynamic>> createFamilyProfile(Map<String, dynamic> body) => api.postJson('/api/patient/family/profiles', body);
  Future<Map<String, dynamic>> inviteFamilyProfile(String profileId) => api.postJson('/api/patient/family/profiles/$profileId/invite', <String, dynamic>{});

  Future<Map<String, dynamic>> patientNotificationSummary() => api.getJson('/api/patient/notifications/summary');
  Future<Map<String, dynamic>> patientNotificationFeed() => api.getJson('/api/patient/notifications/feed');
  Future<Map<String, dynamic>> markPatientNotificationRead(String notificationId) => api.postJson('/api/patient/notifications/feed/$notificationId/read', <String, dynamic>{});
  Future<Map<String, dynamic>> updateNotificationPreference({required String channel, required bool enabled}) => api.postJson('/api/patient/notifications/preferences', <String, dynamic>{
        'channel': channel,
        'enabled': enabled,
      });

  Future<Map<String, dynamic>> patientSupportSummary() => api.getJson('/api/patient/support/summary');
  Future<Map<String, dynamic>> patientSupportTickets() => api.getJson('/api/patient/support/tickets');
  Future<Map<String, dynamic>> createSupportTicket({
    required String subject,
    required String category,
    required String priority,
    required String description,
  }) => api.postJson('/api/patient/support/tickets', <String, dynamic>{
        'subject': subject,
        'category': category,
        'priority': priority,
        'description': description,
      });
  Future<Map<String, dynamic>> commentSupportTicket(String ticketId, String message) => api.postJson('/api/patient/support/tickets/$ticketId/comment', <String, dynamic>{'message': message});

  Future<Map<String, dynamic>> patientReminderSummary() => api.getJson(_withSubjectQuery('/api/patient/reminders/summary'));
  Future<Map<String, dynamic>> patientReminders() => api.getJson(_withSubjectQuery('/api/patient/reminders/medications'));
  Future<Map<String, dynamic>> createReminder({required String medication, required String schedule, required bool enabled}) => api.postJson('/api/patient/reminders/medications', _withSubjectBody(<String, dynamic>{
        'medication': medication,
        'schedule': schedule,
        'enabled': enabled,
      }));
  Future<Map<String, dynamic>> saveReminder({String? id, required String medication, required String schedule, required bool enabled}) => api.postJson('/api/patient/reminders/medications', _withSubjectBody(<String, dynamic>{
        if (id != null && id.isNotEmpty) 'id': id,
        'medication': medication,
        'schedule': schedule,
        'enabled': enabled,
      }));
  Future<Map<String, dynamic>> toggleReminder(String reminderId) => api.postJson('/api/patient/reminders/medications/$reminderId/toggle', _withSubjectBody(<String, dynamic>{}));
  Future<Map<String, dynamic>> logReminderDose(String reminderId, {required String outcome, DateTime? occurredAt}) => api.postJson('/api/patient/reminders/medications/$reminderId/log', _withSubjectBody(<String, dynamic>{
        'outcome': outcome,
        if (occurredAt != null) 'occurredAt': occurredAt.toUtc().toIso8601String(),
      }));
  Future<Map<String, dynamic>> deleteReminder(String reminderId) => api.deleteJson(_withSubjectQuery('/api/patient/reminders/medications/$reminderId'));

  Future<Map<String, dynamic>> patientCarePlanSummary() => api.getJson(_withSubjectQuery('/api/patient/care-plan/summary'));
  Future<Map<String, dynamic>> patientCarePlanTasks() => api.getJson(_withSubjectQuery('/api/patient/care-plan/tasks'));
  Future<Map<String, dynamic>> patientCarePlanTask(String taskId) => api.getJson(_withSubjectQuery('/api/patient/care-plan/tasks/$taskId'));
  Future<Map<String, dynamic>> completeCarePlanTask(String taskId) => api.postJson('/api/patient/care-plan/tasks/$taskId/complete', _withSubjectBody(<String, dynamic>{}));
  Future<Map<String, dynamic>> snoozeCarePlanTask(String taskId) => api.postJson('/api/patient/care-plan/tasks/$taskId/snooze', _withSubjectBody(<String, dynamic>{}));

  Future<Map<String, dynamic>> patientRpmSummary() => api.getJson(_withSubjectQuery('/api/patient/rpm/summary'));
  Future<Map<String, dynamic>> patientRpmProgram() => api.getJson(_withSubjectQuery('/api/patient/rpm/program'));
  Future<Map<String, dynamic>> patientRpmReadings() => api.getJson(_withSubjectQuery('/api/patient/rpm/readings'));
  Future<Map<String, dynamic>> addPatientRpmReading({
    required String metric,
    required String value,
    String? status,
    String? variant,
  }) => api.postJson('/api/patient/rpm/readings', _withSubjectBody(<String, dynamic>{
        'metric': metric,
        'value': value,
        if (status != null && status.isNotEmpty) 'status': status,
        if (variant != null && variant.isNotEmpty) 'variant': variant,
      }));

  Future<Map<String, dynamic>> createAppointment({
    required String providerId,
    required String service,
    required String location,
    required String appointmentType,
    required DateTime startsAt,
    required DateTime endsAt,
    String? notes,
  }) {
    return api.postJson('/api/appointments', _withSubjectBody(<String, dynamic>{
      'patientId': patientProfileId,
      'providerId': providerId,
      'organizationId': organizationId,
      'service': service,
      'location': location,
      'startsAt': startsAt.toUtc().toIso8601String(),
      'endsAt': endsAt.toUtc().toIso8601String(),
      'appointmentType': appointmentType,
      'notes': notes,
    }));
  }

  Future<Map<String, dynamic>> createAppointmentFromHold({
    required String holdId,
    required String providerId,
    required String service,
    required String location,
    required String appointmentType,
    required DateTime startsAt,
    required DateTime endsAt,
    required bool intakeCompleted,
    required bool insuranceUploaded,
    required bool idUploaded,
    required bool authorizationConfirmed,
    required bool policyAccepted,
    required String paymentMethod,
    String? insuranceDocumentId,
    String? idDocumentId,
    String? authorizationDocumentId,
    String? notes,
  }) {
    return api.postJson('/api/appointments/book-with-hold', _withSubjectBody(<String, dynamic>{
      'holdId': holdId,
      'patientId': patientProfileId,
      'providerId': providerId,
      'organizationId': organizationId,
      'service': service,
      'location': location,
      'startsAt': startsAt.toUtc().toIso8601String(),
      'endsAt': endsAt.toUtc().toIso8601String(),
      'appointmentType': appointmentType,
      'notes': notes,
      'intakeCompleted': intakeCompleted,
      'insuranceUploaded': insuranceUploaded,
      'idUploaded': idUploaded,
      'authorizationConfirmed': authorizationConfirmed,
      'policyAccepted': policyAccepted,
      'paymentMethod': paymentMethod,
      if (insuranceDocumentId != null && insuranceDocumentId.isNotEmpty) 'insuranceDocumentId': insuranceDocumentId,
      if (idDocumentId != null && idDocumentId.isNotEmpty) 'idDocumentId': idDocumentId,
      if (authorizationDocumentId != null && authorizationDocumentId.isNotEmpty) 'authorizationDocumentId': authorizationDocumentId,
    }));
  }

  Future<Map<String, dynamic>> createPaymentIntent({
    required String appointmentId,
    required int amountMinor,
    String currency = 'SAR',
    String paymentMethod = 'CARD',
    String? walletMethodId,
    bool authorizationRequired = false,
    bool authorizationConfirmed = false,
    int documentCount = 0,
  }) {
    return api.postJson('/api/payments/intent', <String, dynamic>{
      'appointmentId': appointmentId,
      'amountMinor': amountMinor,
      'currency': currency,
      'metadata': <String, dynamic>{
        'source': 'mobile-app',
        'paymentMethod': paymentMethod,
        'authorizationRequired': authorizationRequired,
        'authorizationConfirmed': authorizationConfirmed,
        'documentCount': documentCount,
        if (walletMethodId != null && walletMethodId.isNotEmpty) 'walletMethodId': walletMethodId,
      },
    });
  }
}
